"""LocalShield AI - Pydantic Request and Response Schemas.

Enforces strict input validation and guarantees that original sensitive values
are NEVER exposed in any API response structure.
"""

from typing import List, Optional
from pydantic import BaseModel, Field

from app.core.config import MAX_AI_RESPONSE_LENGTH, MAX_PROMPT_LENGTH, MIN_PROMPT_LENGTH, PRIVACY_DISCLAIMER


# ---------------------------------------------------------------------------
# Health Schemas
# ---------------------------------------------------------------------------

class HealthResponse(BaseModel):
    """Response model for health check endpoint."""
    status: str = Field(..., examples=["ok"])
    service: str = Field(..., examples=["LocalShield AI Gateway"])
    version: str = Field(..., examples=["0.3.0"])


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


# ---------------------------------------------------------------------------
# Forward Schemas (Phase 3A)
# ---------------------------------------------------------------------------

class ForwardRequest(BaseModel):
    """Request model for forwarding an approved sanitized prompt to the AI provider."""
    session_id: str = Field(
        ...,
        description="The approved session ID from /api/scan and /api/approve.",
        examples=["Xk9Z2_m97z_random_session_id"]
    )
    sanitized_prompt: str = Field(
        ...,
        description="The exact sanitized prompt that was approved by the user.",
        min_length=MIN_PROMPT_LENGTH,
        max_length=MAX_PROMPT_LENGTH,
        examples=["Send email to [EMAIL_1] regarding the update."]
    )


class ForwardResponse(BaseModel):
    """Response returned after forwarding the sanitized prompt to the AI provider.

    Security Guarantee:
    - AI response remains sanitized with placeholders intact.
    - Original sensitive values and provider credentials are never returned.
    """
    session_id: str = Field(..., description="The session ID associated with this request.")
    provider: str = Field(..., description="Name of the AI provider utilized.", examples=["mock"])
    model: str = Field(..., description="Model identifier used for generation.", examples=["mock-llama-3"])
    sanitized_response: str = Field(
        ...,
        description="The sanitized response from the AI provider, preserving placeholders.",
        examples=["I received your request. Regarding [EMAIL_1], I will follow up shortly."]
    )
    is_mock: bool = Field(..., description="True if generated by the offline mock provider.", examples=[True])
    disclaimer: str = Field(
        default=PRIVACY_DISCLAIMER,
        description="Privacy boundary statement."
    )


# ---------------------------------------------------------------------------
# Unmask Schemas (Phase 3B)
# ---------------------------------------------------------------------------

class UnmaskRequest(BaseModel):
    """Request model for restoring placeholders in an AI response."""
    session_id: str = Field(
        ...,
        description="The active approved session ID containing the placeholder mapping.",
        examples=["Xk9Z2_m97z_random_session_id"]
    )
    sanitized_response: str = Field(
        ...,
        description="The sanitized response returned by the AI provider to be unmasked.",
        min_length=1,
        max_length=MAX_AI_RESPONSE_LENGTH,
        examples=["I will follow up with [EMAIL_1] regarding the incident."]
    )


class UnmaskResponse(BaseModel):
    """Response returned after safe placeholder restoration.

    Security Guarantee:
    - Only validated placeholders belonging to the active session are restored.
    - Hallucinated or unrecognized placeholders are left unrestored and flagged.
    """
    session_id: str = Field(..., description="The session ID utilized for restoration.")
    restored_text: str = Field(
        ...,
        description="Response text with validated placeholders safely replaced by original values."
    )
    restored_placeholders: List[str] = Field(
        default_factory=list,
        description="List of placeholders that were successfully substituted."
    )
    unrecognized_placeholders: List[str] = Field(
        default_factory=list,
        description="List of unknown or hallucinated placeholders that were NOT substituted."
    )
    warnings: List[str] = Field(
        default_factory=list,
        description="Alerts regarding placeholder anomalies or missing entities."
    )
    disclaimer: str = Field(
        default=PRIVACY_DISCLAIMER,
        description="Privacy boundary statement."
    )
