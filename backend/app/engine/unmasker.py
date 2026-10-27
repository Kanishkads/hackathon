"""LocalShield AI - Response Unmasker Engine.

Validates placeholder tokens in AI responses against the active session's
placeholder mapping. Restores ONLY exact, validated placeholders.
Safely detects and flags hallucinated (e.g., [EMAIL_99]) or malformed placeholders
without attempting to substitute them.
"""

from dataclasses import dataclass, field
import re
from typing import Dict, List, Optional, Set, Tuple


@dataclass
class UnmaskResult:
    """Encapsulates the result of a response unmasking operation.

    Attributes:
        restored_text: Text with valid placeholders safely replaced by original values.
        restored_placeholders: List of placeholders that were successfully substituted.
        unrecognized_placeholders: List of unknown/hallucinated placeholders (left unchanged).
        malformed_placeholders: List of malformed placeholder tokens (left unchanged).
        redacted_placeholders: List of high-risk credentials kept safely redacted.
        warnings: Human-readable warning messages about placeholder anomalies or leaks.
        leak_detected: True if the raw AI response leaked original sensitive values.
    """
    restored_text: str
    restored_placeholders: List[str] = field(default_factory=list)
    unrecognized_placeholders: List[str] = field(default_factory=list)
    malformed_placeholders: List[str] = field(default_factory=list)
    redacted_placeholders: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    leak_detected: bool = False

    def __repr__(self) -> str:
        """Safe string representation that never exposes restored sensitive values."""
        return (
            f"UnmaskResult("
            f"restored_count={len(self.restored_placeholders)}, "
            f"restored_placeholders={self.restored_placeholders}, "
            f"unrecognized={self.unrecognized_placeholders}, "
            f"malformed={self.malformed_placeholders}, "
            f"redacted={self.redacted_placeholders}, "
            f"leak_detected={self.leak_detected}, "
            f"warnings_count={len(self.warnings)})"
        )


class ResponseUnmasker:
    """Validates and restores placeholders in AI responses using an ephemeral session mapping."""

    # Matches any bracketed alphanumeric token that could be a placeholder candidate
    PLACEHOLDER_CANDIDATE_PATTERN = re.compile(r'\[[A-Za-z0-9_]+\]')

    # Strict pattern for valid LocalShield placeholder syntax: [TYPE_#]
    VALID_SYNTAX_PATTERN = re.compile(r'^\[[A-Z_]+_\d+\]$')

    # Prefixes known to our masking engine to identify malformed attempts
    KNOWN_ENTITY_PREFIXES = ("PERSON", "EMAIL", "PHONE", "API_KEY", "PASSWORD")

    # Policy definitions
    DEFAULT_PERMITTED_TYPES: Set[str] = {"PERSON", "EMAIL", "PHONE"}
    HIGH_RISK_CREDENTIAL_TYPES: Set[str] = {"PASSWORD", "API_KEY"}

    def unmask(
        self,
        response_text: str,
        session_mapping: Dict[str, str],
        permitted_types: Optional[Set[str]] = None,
        redact_high_risk: bool = True
    ) -> UnmaskResult:
        """Restores validated placeholders in the AI response text according to policy.

        Rules:
        1. Checks for response leaks: if the raw response already contains unmasked
           sensitive values, restoration is aborted to avoid propagating leaks.
        2. Only placeholders present in session_mapping and permitted by policy are restored.
        3. High-risk credentials (passwords, API keys) are kept redacted by default.
        4. Unknown placeholders (e.g., [EMAIL_99]) are left intact and flagged as unrecognized.
        5. Malformed placeholders (e.g., [EMAIL_], [PHONE_abc]) are left intact and flagged.
        6. Substring collisions are avoided via tokenized regex replacement.
        7. Placeholders not present in the response are never inserted.

        Args:
            response_text: Sanitized text returned by the AI provider.
            session_mapping: Ephemeral dictionary of {placeholder: original_value}.
            permitted_types: Optional set of allowed entity types (defaults to PERSON, EMAIL, PHONE).
            redact_high_risk: If True, keep PASSWORD and API_KEY placeholders redacted.

        Returns:
            An UnmaskResult with restored text, restored placeholders, and security warnings.
        """
        if not response_text:
            return UnmaskResult(
                restored_text="",
                restored_placeholders=[],
                unrecognized_placeholders=[],
                malformed_placeholders=[],
                redacted_placeholders=[],
                warnings=["Empty response provided for unmasking."]
            )

        if not session_mapping:
            # No placeholders were mapped in this session
            candidates = self.PLACEHOLDER_CANDIDATE_PATTERN.findall(response_text)
            unrecognized = [c for c in candidates if self.VALID_SYNTAX_PATTERN.match(c)]
            warnings = []
            if unrecognized:
                warnings.append(
                    f"Response contains placeholders {unrecognized}, but this session has no active mapping."
                )
            return UnmaskResult(
                restored_text=response_text,
                restored_placeholders=[],
                unrecognized_placeholders=unrecognized,
                malformed_placeholders=[],
                redacted_placeholders=[],
                warnings=warnings
            )

        allowed_types = permitted_types if permitted_types is not None else self.DEFAULT_PERMITTED_TYPES

        # 1. Response Leak Checker
        leaked_placeholders: List[str] = []
        for ph, secret_val in session_mapping.items():
            if len(secret_val) >= 3 and secret_val in response_text:
                leaked_placeholders.append(ph)

        if leaked_placeholders:
            return UnmaskResult(
                restored_text=response_text,
                restored_placeholders=[],
                unrecognized_placeholders=[],
                malformed_placeholders=[],
                redacted_placeholders=[],
                warnings=[
                    f"SECURITY ALERT: Response leak detected! Raw sensitive value(s) for "
                    f"{', '.join(sorted(leaked_placeholders))} were found directly in the AI response. "
                    "Placeholder restoration blocked to prevent data exposure."
                ],
                leak_detected=True,
            )

        # 2. Analyze all bracketed candidates in the response text
        all_candidates: List[str] = self.PLACEHOLDER_CANDIDATE_PATTERN.findall(response_text)

        restored_set: Set[str] = set()
        redacted_set: Set[str] = set()
        unrecognized_set: Set[str] = set()
        malformed_set: Set[str] = set()
        warnings: List[str] = []

        for candidate in all_candidates:
            if candidate in session_mapping:
                # Extract entity type prefix (e.g. "[EMAIL_1]" -> "EMAIL")
                clean_type = candidate.strip("[]").rsplit("_", 1)[0]

                if redact_high_risk and clean_type in self.HIGH_RISK_CREDENTIAL_TYPES:
                    redacted_set.add(candidate)
                elif clean_type in allowed_types:
                    restored_set.add(candidate)
                else:
                    # Token registered, but entity type not permitted by caller policy
                    redacted_set.add(candidate)
            elif self.VALID_SYNTAX_PATTERN.match(candidate):
                # Well-formed syntax [TYPE_#], but NOT registered in this session
                unrecognized_set.add(candidate)
            elif any(candidate.startswith(f"[{p}") for p in self.KNOWN_ENTITY_PREFIXES):
                # Malformed attempt at an entity placeholder (e.g. [EMAIL_], [PHONE_abc])
                malformed_set.add(candidate)

        # Assemble alerts
        if unrecognized_set:
            unrec_list = sorted(list(unrecognized_set))
            warnings.append(
                f"Unknown or hallucinated placeholder(s) detected: {', '.join(unrec_list)}. "
                "These do not exist in the active session mapping and were NOT restored."
            )

        if malformed_set:
            malf_list = sorted(list(malformed_set))
            warnings.append(
                f"Malformed placeholder token(s) detected: {', '.join(malf_list)}. "
                "These could not be validated and were left unchanged."
            )

        if redacted_set:
            red_list = sorted(list(redacted_set))
            warnings.append(
                f"High-risk credential placeholder(s) kept redacted by policy: {', '.join(red_list)}."
            )

        if not restored_set and not unrecognized_set and not malformed_set and not redacted_set:
            warnings.append("No sensitive placeholders were detected in the AI response.")

        # 3. Tokenized replacement: Only substitute registered, policy-permitted placeholders
        def _replace_token(match: re.Match) -> str:
            token = match.group(0)
            if token in restored_set:
                return session_mapping[token]
            return token

        restored_text = self.PLACEHOLDER_CANDIDATE_PATTERN.sub(_replace_token, response_text)

        return UnmaskResult(
            restored_text=restored_text,
            restored_placeholders=sorted(list(restored_set)),
            unrecognized_placeholders=sorted(list(unrecognized_set)),
            malformed_placeholders=sorted(list(malformed_set)),
            redacted_placeholders=sorted(list(redacted_set)),
            warnings=warnings,
            leak_detected=False
        )

