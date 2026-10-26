"""LocalShield AI - Pydantic Request and Response Schemas.

Enforces strict input validation and guarantees that original sensitive values
are NEVER exposed in any API response structure.
"""

from typing import List, Optional
from pydantic import BaseModel, Field

from app.core.config import MAX_PROMPT_LENGTH, MIN_PROMPT_LENGTH, PRIVACY_DISCLAIMER


# ---------------------------------------------------------------------------
# Health Schemas
# ---------------------------------------------------------------------------

class HealthResponse(BaseModel):
    """Response model for health check endpoint."""
    status: str = Field(..., examples=["ok"])
    service: str = Field(..., examples=["LocalShield AI Gateway"])
    version: str = Field(..., examples=["0.2.0"])


# ---------------------------------------------------------------------------
# Scan Schemas
# ---------------------------------------------------------------------------

class ScanRequest(BaseModel):
    """Request model for prompt scanning and sanitization.

    Enforces input length boundaries to prevent resource exhaustion attacks.
    """
    prompt: str = Field(
        ...,
        description="The raw prompt to be scanned for sensitive data.",
        min_length=MIN_PROMPT_LENGTH,
        max_length=MAX_PROMPT_LENGTH,
        examples=["My email is alice@example.com, please summarize our security policy."]
    )


class EntityDetectionInfo(BaseModel):
    """Safe metadata describing a detected entity without exposing the sensitive value."""
    entity_type: str = Field(..., description="Category (EMAIL, PHONE, API_KEY, PASSWORD).", examples=["EMAIL"])
    placeholder: str = Field(..., description="Assigned placeholder token.", examples=["[EMAIL_1]"])
    confidence: str = Field(..., description="Confidence label (HIGH, MEDIUM, LOW).", examples=["HIGH"])


class ScanResponse(BaseModel):
    """Structured response returned by /api/scan.

    Security Guarantee: Never contains original sensitive values or raw secrets.
    """
    session_id: str = Field(..., description="Cryptographically secure ephemeral session ID.")
    sanitized_prompt: str = Field(..., description="Prompt with all detected sensitive values replaced.")
    entity_types: List[str] = Field(default_factory=list, description="Unique entity types detected.")
    placeholders: List[str] = Field(default_factory=list, description="Placeholders assigned in the sanitized prompt.")
    entities_detected: List[EntityDetectionInfo] = Field(
        default_factory=list,
        description="Non-sensitive detection details (type, placeholder, confidence)."
    )
    warnings: List[str] = Field(
        default_factory=list,
        description="Alerts regarding uncertain detections or scan boundaries."
    )
    disclaimer: str = Field(
        default=PRIVACY_DISCLAIMER,
        description="Clear boundary statement regarding privacy and heuristic limitations."
    )


# ---------------------------------------------------------------------------
# Approval Schemas
# ---------------------------------------------------------------------------

class ApproveRequest(BaseModel):
    """Request model for verifying user approval of a sanitized prompt."""
    session_id: str = Field(..., description="The session ID returned during /api/scan.")
    sanitized_prompt: str = Field(
        ...,
        description="The exact sanitized prompt that the user approved.",
        min_length=MIN_PROMPT_LENGTH,
        max_length=MAX_PROMPT_LENGTH
    )


class ApproveResponse(BaseModel):
    """Response model for approval validation."""
    session_id: str
    approved: bool
    message: str
    sanitized_prompt_hash: str


# ---------------------------------------------------------------------------
# Session Status Schemas
# ---------------------------------------------------------------------------

class SessionStatusResponse(BaseModel):
    """Non-sensitive session status inspection."""
    session_id: str
    exists: bool
    is_approved: bool
    placeholders: List[str]
    entity_types: List[str]
    expires_in_seconds: int
