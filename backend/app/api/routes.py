"""LocalShield AI - API Endpoints.

Defines the core REST endpoints for:
- Health checks (GET /api/health)
- Sensitive prompt scanning and sanitization (POST /api/scan)
- Server-side approval validation (POST /api/approve)
- Ephemeral session status inspection (GET /api/session/{session_id}/status)
- Secure AI forwarding with approved sanitized prompt (POST /api/forward)
- AI response placeholder validation and safe restoration (POST /api/unmask)
"""

import hmac
import time
from typing import Dict, List, Tuple
from fastapi import APIRouter, HTTPException, status

from app.core.config import (
    MAX_PROMPT_LENGTH,
    PRIVACY_DISCLAIMER,
    SERVICE_NAME,
    VERSION,
)
from app.core.session import session_manager
from app.engine.detector import Confidence, DetectedEntity, SensitiveEntityDetector
from app.engine.masker import Masker
from app.engine.unmasker import ResponseUnmasker
from app.models.schemas import (
    ApproveRequest,
    ApproveResponse,
    EntityDetectionInfo,
    ForwardRequest,
    ForwardResponse,
    HealthResponse,
    ScanRequest,
    ScanResponse,
    SessionStatusResponse,
    UnmaskRequest,
    UnmaskResponse,
)
from app.services import (
    AIProviderConfigError,
    AIProviderError,
    AIProviderTimeoutError,
    get_ai_provider,
)

router = APIRouter(prefix="/api", tags=["Gateway"])

# Instantiate engine components once at module load
detector = SensitiveEntityDetector()
masker = Masker(detector=detector)
unmasker = ResponseUnmasker()


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Health Check",
    description="Returns the gateway operational status, service name, and version."
)
def get_health() -> HealthResponse:
    """Returns gateway status."""
    return HealthResponse(
        status="ok",
        service=SERVICE_NAME,
        version=VERSION,
    )


@router.post(
    "/scan",
    response_model=ScanResponse,
    status_code=status.HTTP_200_OK,
    summary="Scan and Mask Prompt",
    description="Detects sensitive information, generates a sanitized preview with placeholders, and creates an ephemeral session."
)
def scan_prompt(request: ScanRequest) -> ScanResponse:
    """Scans the prompt, produces a sanitized preview, and records an ephemeral session.

    Security Guarantees:
    - Never echoes raw sensitive values in the response.
    - Stores the mapping strictly in server-side volatile memory.
    - Enforces input bounds against denial-of-service payloads.
    """
    raw_prompt = request.prompt

    # Input validation: reject blank or whitespace-only prompts
    if not raw_prompt or not raw_prompt.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Prompt cannot be empty or whitespace only."
        )

    # Input validation: enforce maximum character limit
    if len(raw_prompt) > MAX_PROMPT_LENGTH:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Prompt exceeds maximum allowed size of {MAX_PROMPT_LENGTH} characters."
        )

    # 1. Detection
    detected_entities: List[DetectedEntity] = detector.detect(raw_prompt)

    # 2. Masking
    mask_result = masker.mask(raw_prompt, entities=detected_entities)

    # Build reverse mapping to link each detected entity to its placeholder
    # mask_result.mapping is {placeholder: original_value}
    value_to_placeholder: Dict[str, str] = {
        val: ph for ph, val in mask_result.mapping.items()
    }

    entities_info: List[EntityDetectionInfo] = []
    has_uncertain_confidence = False

    for entity in detected_entities:
        placeholder = value_to_placeholder.get(entity.value, f"[{entity.entity_type}]")
        entities_info.append(
            EntityDetectionInfo(
                entity_type=entity.entity_type,
                placeholder=placeholder,
                confidence=entity.confidence
            )
        )
        if entity.confidence in {Confidence.MEDIUM.value, Confidence.LOW.value}:
            has_uncertain_confidence = True

    # 3. Assemble warning signals
    warnings: List[str] = []
    if has_uncertain_confidence:
        warnings.append(
            "Some detected items have uncertain confidence (MEDIUM/LOW). "
            "Please inspect the sanitized preview carefully."
        )

    if not detected_entities:
        warnings.append(
            "No recognized sensitive patterns were detected. Note that unusual or conversational "
            "secrets may not be caught by rule-based detection."
        )

    unique_types = sorted(list(set(e.entity_type for e in detected_entities)))
    placeholders_list = list(mask_result.mapping.keys())

    # 4. Ephemeral Session Creation
    session = session_manager.create_session(
        sanitized_prompt=mask_result.sanitized_text,
        mapping=mask_result.mapping,
        entity_types=unique_types,
        placeholders=placeholders_list
    )

    return ScanResponse(
        session_id=session.session_id,
        sanitized_prompt=mask_result.sanitized_text,
        entity_types=unique_types,
        placeholders=placeholders_list,
        entities_detected=entities_info,
        warnings=warnings,
        disclaimer=PRIVACY_DISCLAIMER
    )


@router.post(
    "/approve",
    response_model=ApproveResponse,
    status_code=status.HTTP_200_OK,
    summary="Approve Sanitized Prompt",
    description="Validates that the client approved the exact sanitized prompt associated with an active session."
)
def approve_prompt(request: ApproveRequest) -> ApproveResponse:
    """Server-side approval gate.

    Verifies the session exists, is not expired, and matches the SHA-256 hash
    of the submitted sanitized prompt. Rejects mismatched or expired sessions.
    """
    success, message = session_manager.approve_session(
        session_id=request.session_id,
        sanitized_prompt=request.sanitized_prompt
    )

    if not success:
        if "not found" in message or "expired" in message:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=message
            )
        # Hash mismatch / tampering
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=message
        )

    prompt_hash = session_manager.hash_prompt(request.sanitized_prompt)

    return ApproveResponse(
        session_id=request.session_id,
        approved=True,
        message=message,
        sanitized_prompt_hash=prompt_hash
    )


@router.get(
    "/session/{session_id}/status",
    response_model=SessionStatusResponse,
    summary="Inspect Session Status",
    description="Returns metadata about an active session without exposing any sensitive values or prompt text."
)
def get_session_status(session_id: str) -> SessionStatusResponse:
    """Returns non-sensitive metadata about an active session."""
    session = session_manager.get_session(session_id)
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found or has expired."
        )

    now = time.time()
    remaining_seconds = max(0, int(session.expires_at - now))

    return SessionStatusResponse(
        session_id=session.session_id,
        exists=True,
        is_approved=session.is_approved,
        placeholders=session.placeholders,
        entity_types=session.entity_types,
        expires_in_seconds=remaining_seconds
    )


@router.post(
    "/forward",
    response_model=ForwardResponse,
    status_code=status.HTTP_200_OK,
    summary="Forward Approved Sanitized Prompt",
    description="Transmits the approved sanitized prompt to the configured AI provider. Fails closed if unapproved."
)
async def forward_prompt(request: ForwardRequest) -> ForwardResponse:
    """Forwards the approved sanitized prompt to the AI provider.

    Strict Security Guarantees:
    1. Rejects missing, invalid, or expired sessions (HTTP 404).
    2. Rejects unapproved sessions (HTTP 403 Forbidden).
    3. Rejects tampered / mismatched sanitized prompts (HTTP 400 Bad Request).
    4. Forwards ONLY the approved sanitized prompt. Never sends original prompts or mappings.
    5. Returns the AI response in sanitized form (unmasking is performed via POST /api/unmask).
    """
    session = session_manager.get_session(request.session_id)
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found or has expired. Please re-scan and approve your prompt."
        )

    # 1. Enforce server-side approval check
    if not session.is_approved:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Approval required: The prompt must be reviewed and approved via /api/approve before forwarding."
        )

    # 2. Enforce prompt integrity (constant-time hash comparison)
    candidate_hash = session_manager.hash_prompt(request.sanitized_prompt)
    if not hmac.compare_digest(session.sanitized_prompt_hash, candidate_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Sanitized prompt does not match the approved session."
        )

    # 3. Instantiate configured AI provider
    try:
        provider = get_ai_provider()
    except AIProviderConfigError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc)
        )

    # 4. Forward strictly sanitized prompt to provider
    try:
        ai_response = await provider.generate(request.sanitized_prompt)
    except AIProviderTimeoutError:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="AI provider request timed out."
        )
    except AIProviderError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"AI provider communication error: {str(exc)}"
        )
    except Exception:
        # Fallback for unexpected failures without leaking internal details
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="An error occurred while communicating with the AI provider."
        )

    return ForwardResponse(
        session_id=session.session_id,
        provider=provider.provider_name,
        model=provider.model_name,
        sanitized_response=ai_response,
        is_mock=provider.is_mock,
        disclaimer=PRIVACY_DISCLAIMER
    )


@router.post(
    "/unmask",
    response_model=UnmaskResponse,
    status_code=status.HTTP_200_OK,
    summary="Validate and Restore Placeholders",
    description="Safely restores validated placeholders in an AI response using the active approved session mapping."
)
def unmask_response(request: UnmaskRequest) -> UnmaskResponse:
    """Restores placeholders in the AI response using the session's mapping.

    Security Guarantees:
    1. Rejects missing, invalid, or expired sessions (HTTP 404).
    2. Rejects unapproved sessions (HTTP 403 Forbidden).
    3. Rejects empty or whitespace-only response bodies (HTTP 400 Bad Request).
    4. Validates every placeholder: ONLY placeholders existing in the session mapping are substituted.
    5. Flags and leaves intact any unknown (e.g. [EMAIL_99]) or malformed placeholders.
    6. Never exposes mappings across sessions.
    """
    raw_response = request.sanitized_response
    if not raw_response or not raw_response.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Response text cannot be empty or whitespace only."
        )

    session = session_manager.get_session(request.session_id)
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found or has expired. Please re-scan your prompt."
        )

    if not session.is_approved:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Approval required: The session must be approved before unmasking responses."
        )

    # Perform safe restoration using the isolated session mapping
    result = unmasker.unmask(
        response_text=raw_response,
        session_mapping=session.mapping
    )

    return UnmaskResponse(
        session_id=session.session_id,
        restored_text=result.restored_text,
        restored_placeholders=result.restored_placeholders,
        unrecognized_placeholders=result.unrecognized_placeholders,
        warnings=result.warnings,
        disclaimer=PRIVACY_DISCLAIMER
    )
