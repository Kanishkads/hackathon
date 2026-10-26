"""LocalShield AI - Secure In-Memory Session Management.

Manages ephemeral session mappings for placeholders. 
Stores mappings strictly in volatile server memory with time-based expiration (TTL).
Never persists mappings, sensitive values, or prompts to disk or database.

Note on Prototype Limitations:
This in-memory session store is designed for single-node prototypes and hackathon demos.
It does not persist across application restarts or support multi-instance horizontal scaling.
Production deployments would require an encrypted distributed cache (e.g., Redis with KMS).
"""

from dataclasses import dataclass, field
import hashlib
import hmac
import secrets
import threading
import time
from typing import Dict, List, Optional, Tuple

from app.core.config import SESSION_TTL_SECONDS


@dataclass
class SessionData:
    """Represents an active in-memory session.

    Attributes:
        session_id: Cryptographically secure identifier.
        sanitized_prompt_hash: SHA-256 hash of the sanitized prompt for approval verification.
        mapping: Ephemeral dictionary of placeholder -> original sensitive value.
        entity_types: List of unique entity types found.
        placeholders: List of placeholders assigned.
        created_at: Epoch timestamp of creation.
        expires_at: Epoch timestamp after which the session is considered invalid.
        is_approved: Boolean indicating whether the user explicitly approved this prompt.
        approved_at: Epoch timestamp of approval, if granted.
    """
    session_id: str
    sanitized_prompt_hash: str
    mapping: Dict[str, str] = field(default_factory=dict)
    entity_types: List[str] = field(default_factory=list)
    placeholders: List[str] = field(default_factory=list)
    created_at: float = field(default_factory=time.time)
    expires_at: float = 0.0
    is_approved: bool = False
    approved_at: Optional[float] = None

    def __post_init__(self):
        if self.expires_at == 0.0:
            self.expires_at = self.created_at + SESSION_TTL_SECONDS

    def is_expired(self, current_time: Optional[float] = None) -> bool:
        """Returns True if the session has exceeded its time-to-live."""
        now = current_time if current_time is not None else time.time()
        return now >= self.expires_at

    def __repr__(self) -> str:
        """Safe string representation that never exposes mapped sensitive values."""
        return (
            f"SessionData(id={self.session_id[:8]}..., "
            f"placeholders={self.placeholders}, "
            f"is_approved={self.is_approved}, "
            f"expires_in={max(0, int(self.expires_at - time.time()))}s)"
        )


class SecureSessionManager:
    """Thread-safe, ephemeral in-memory session manager for prompt masking operations."""

    def __init__(self, default_ttl_seconds: int = SESSION_TTL_SECONDS):
        self._sessions: Dict[str, SessionData] = {}
        self._lock = threading.Lock()
        self._default_ttl = default_ttl_seconds

    def create_session(
        self,
        sanitized_prompt: str,
        mapping: Dict[str, str],
        entity_types: List[str],
        placeholders: List[str],
        ttl_seconds: Optional[int] = None,
    ) -> SessionData:
        """Creates and stores a new isolated session with a cryptographically secure ID.

        Args:
            sanitized_prompt: The sanitized text produced by the masker.
            mapping: Placeholder to sensitive value dictionary.
            entity_types: Detected categories.
            placeholders: Assigned placeholder tokens.
            ttl_seconds: Optional custom TTL in seconds.

        Returns:
            The created SessionData object.
        """
        # Generate 32 bytes (256 bits) of cryptographic entropy
        session_id = secrets.token_urlsafe(32)

        # Compute SHA-256 hash of sanitized prompt for tamper-evident approval validation
        prompt_hash = self.hash_prompt(sanitized_prompt)

        ttl = ttl_seconds if ttl_seconds is not None else self._default_ttl
        now = time.time()

        session = SessionData(
            session_id=session_id,
            sanitized_prompt_hash=prompt_hash,
            mapping=dict(mapping),  # Defensive copy to ensure session isolation
            entity_types=list(entity_types),
            placeholders=list(placeholders),
            created_at=now,
            expires_at=now + ttl,
            is_approved=False,
            approved_at=None,
        )

        with self._lock:
            # Clean up expired sessions periodically during writes
            self._cleanup_expired_unsafe(now)
            self._sessions[session_id] = session

        return session

    def get_session(self, session_id: str) -> Optional[SessionData]:
        """Retrieves an active session if it exists and has not expired.

        Returns None if missing or expired.
        """
        if not session_id or not isinstance(session_id, str):
            return None

        now = time.time()
        with self._lock:
            session = self._sessions.get(session_id)
            if session is None:
                return None

            if session.is_expired(now):
                # Expired: delete immediately and return None
                del self._sessions[session_id]
                return None

            return session

    def approve_session(
        self,
        session_id: str,
        sanitized_prompt: str,
    ) -> Tuple[bool, str]:
        """Server-side approval validation.

        Verifies that:
        1. The session exists and has not expired.
        2. The provided sanitized prompt matches the exact prompt hashed during /api/scan.
           This prevents client-side prompt tampering or spoofed approvals.

        Args:
            session_id: Session identifier.
            sanitized_prompt: The exact sanitized prompt text the user approved.

        Returns:
            Tuple of (success_bool, message).
        """
        if not session_id or not sanitized_prompt:
            return False, "Missing session ID or sanitized prompt."

        now = time.time()
        candidate_hash = self.hash_prompt(sanitized_prompt)

        with self._lock:
            session = self._sessions.get(session_id)
            if session is None:
                return False, "Session not found."

            if session.is_expired(now):
                del self._sessions[session_id]
                return False, "Session has expired. Please re-scan your prompt."

            # Constant-time comparison to prevent timing attacks
            if not hmac.compare_digest(session.sanitized_prompt_hash, candidate_hash):
                return False, "Sanitized prompt does not match the scanned session."

            # Mark approved
            session.is_approved = True
            session.approved_at = now
            return True, "Session approved successfully."

    def delete_session(self, session_id: str) -> bool:
        """Explicitly deletes a session from memory."""
        with self._lock:
            if session_id in self._sessions:
                del self._sessions[session_id]
                return True
            return False

    def cleanup_expired_sessions(self) -> int:
        """Public sweep method to remove all expired sessions from memory."""
        now = time.time()
        with self._lock:
            return self._cleanup_expired_unsafe(now)

    def _cleanup_expired_unsafe(self, current_time: float) -> int:
        """Internal helper for cleanup. Caller must hold self._lock."""
        expired_ids = [
            sid for sid, s in self._sessions.items()
            if s.is_expired(current_time)
        ]
        for sid in expired_ids:
            del self._sessions[sid]
        return len(expired_ids)

    def count_active_sessions(self) -> int:
        """Returns the number of currently active, non-expired sessions."""
        now = time.time()
        with self._lock:
            return sum(1 for s in self._sessions.values() if not s.is_expired(now))

    @staticmethod
    def hash_prompt(prompt: str) -> str:
        """Calculates SHA-256 hex digest of a prompt."""
        return hashlib.sha256(prompt.encode("utf-8")).hexdigest()


# Global singleton instance for application use
session_manager = SecureSessionManager()
