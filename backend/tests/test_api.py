"""Unit and integration tests for LocalShield AI FastAPI endpoints.

Tests:
- GET /api/health
- POST /api/scan (success, masking, repeated values, warnings)
- Validation errors (empty, whitespace, oversized, malformed bodies)
- Security guarantees (original sensitive values are NEVER returned)
- Server-side approval gate (matching, tampering, invalid, expired)
- Session isolation and lifecycle management
- Safe error handling and HTTP status codes
"""

from pathlib import Path
import sys
import time

# Ensure backend package is in python path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient
import pytest

from app.core.config import MAX_PROMPT_LENGTH, SERVICE_NAME, VERSION
from app.core.session import SecureSessionManager, session_manager
from app.main import app

client = TestClient(app)


# ---------------------------------------------------------------------------
# Health Endpoint Tests
# ---------------------------------------------------------------------------

class TestHealthEndpoint:
    """Tests for GET /api/health."""

    def test_health_success(self):
        response = client.get("/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert data["service"] == SERVICE_NAME
        assert data["version"] == VERSION

    def test_root_endpoint(self):
        response = client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert "docs" in data
        assert "health" in data


# ---------------------------------------------------------------------------
# Scan Endpoint Tests
# ---------------------------------------------------------------------------

class TestScanEndpoint:
    """Tests for POST /api/scan."""

    def test_scan_email_and_phone_success(self):
        raw_email = "synthetic.user@example.com"
        raw_phone = "+1-555-0199"
        payload = {
            "prompt": f"Please send project update to {raw_email} or call {raw_phone}."
        }
        response = client.post("/api/scan", json=payload)
        assert response.status_code == 200

        data = response.json()
        assert "session_id" in data
        assert len(data["session_id"]) >= 32
        assert "[EMAIL_1]" in data["sanitized_prompt"]
        assert "[PHONE_1]" in data["sanitized_prompt"]
        assert raw_email not in data["sanitized_prompt"]
        assert raw_phone not in data["sanitized_prompt"]

        assert "EMAIL" in data["entity_types"]
        assert "PHONE" in data["entity_types"]
        assert "[EMAIL_1]" in data["placeholders"]
        assert "[PHONE_1]" in data["placeholders"]
        assert len(data["entities_detected"]) == 2
        assert "disclaimer" in data

    def test_repeated_values_share_placeholder(self):
        raw_email = "dev.support@example.com"
        payload = {
            "prompt": f"Contact {raw_email}. Again, send mail to {raw_email} asap."
        }
        response = client.post("/api/scan", json=payload)
        assert response.status_code == 200

        data = response.json()
        assert data["sanitized_prompt"].count("[EMAIL_1]") == 2
        assert "[EMAIL_2]" not in data["placeholders"]
        assert raw_email not in data["sanitized_prompt"]

    def test_scan_api_key_and_password(self):
        key = "sk-proj-fictional1234567890abcdef1234567890"
        password = "SyntheticPass123!"
        payload = {
            "prompt": f'api_key = "{key}"\npassword = "{password}"'
        }
        response = client.post("/api/scan", json=payload)
        assert response.status_code == 200

        data = response.json()
        assert "[API_KEY_1]" in data["sanitized_prompt"]
        assert "[PASSWORD_1]" in data["sanitized_prompt"]
        assert key not in data["sanitized_prompt"]
        assert password not in data["sanitized_prompt"]

    def test_scan_non_sensitive_prompt_warnings(self):
        payload = {"prompt": "Explain the difference between TCP and UDP in networking."}
        response = client.post("/api/scan", json=payload)
        assert response.status_code == 200

        data = response.json()
        assert data["sanitized_prompt"] == payload["prompt"]
        assert data["placeholders"] == []
        assert data["entity_types"] == []
        assert len(data["warnings"]) > 0
        assert "No recognized sensitive patterns" in data["warnings"][0]

    def test_scan_zero_sensitive_data_leakage(self):
        """Strict assertion: No sensitive value appears anywhere in the JSON response or headers."""
        secret_email = "topsecret.agent77@example.com"
        secret_key = "ghp_fictionaltoken1234567890abcdef123456"
        secret_pass = "UltraSecretPassword999!"

        payload = {
            "prompt": f"User: {secret_email}, Key: {secret_key}, Pass: password = '{secret_pass}'"
        }
        response = client.post("/api/scan", json=payload)
        assert response.status_code == 200

        raw_body_text = response.text
        assert secret_email not in raw_body_text
        assert secret_key not in raw_body_text
        assert secret_pass not in raw_body_text

        # Verify headers as well
        for header_val in response.headers.values():
            assert secret_email not in header_val
            assert secret_key not in header_val
            assert secret_pass not in header_val


# ---------------------------------------------------------------------------
# Validation & Error Handling Tests
# ---------------------------------------------------------------------------

class TestValidationAndErrors:
    """Tests for bad requests, input boundaries, and malformed bodies."""

    def test_empty_string_rejected(self):
        response = client.post("/api/scan", json={"prompt": ""})
        assert response.status_code == 422  # Pydantic min_length constraint

    def test_whitespace_only_rejected(self):
        response = client.post("/api/scan", json={"prompt": "     \n\t   "})
        assert response.status_code == 400
        assert "whitespace only" in response.json()["detail"]

    def test_missing_prompt_field(self):
        response = client.post("/api/scan", json={"other_field": "data"})
        assert response.status_code == 422
        assert "prompt" in response.text

    def test_malformed_json_body(self):
        response = client.post(
            "/api/scan",
            content="Not a valid json string",
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 422

    def test_invalid_http_method(self):
        response = client.delete("/api/scan")
        assert response.status_code == 405

    def test_oversized_prompt_rejected(self):
        huge_prompt = "A" * (MAX_PROMPT_LENGTH + 50)
        response = client.post("/api/scan", json={"prompt": huge_prompt})
        assert response.status_code in {413, 422}


# ---------------------------------------------------------------------------
# Server-Side Approval Gate Tests
# ---------------------------------------------------------------------------

class TestApprovalGate:
    """Tests for POST /api/approve and server-side validation."""

    def test_successful_approval(self):
        # 1. First scan a prompt to create an active session
        scan_res = client.post(
            "/api/scan",
            json={"prompt": "Notify bob@example.com of the release."}
        )
        assert scan_res.status_code == 200
        scan_data = scan_res.json()
        session_id = scan_data["session_id"]
        sanitized_prompt = scan_data["sanitized_prompt"]

        # 2. Approve the exact sanitized prompt
        approve_res = client.post(
            "/api/approve",
            json={
                "session_id": session_id,
                "sanitized_prompt": sanitized_prompt
            }
        )
        assert approve_res.status_code == 200
        data = approve_res.json()
        assert data["approved"] is True
        assert data["session_id"] == session_id
        assert "sanitized_prompt_hash" in data

        # 3. Verify session status reflects approval
        status_res = client.get(f"/api/session/{session_id}/status")
        assert status_res.status_code == 200
        assert status_res.json()["is_approved"] is True

    def test_approval_tampered_prompt_rejected(self):
        """If the client tampers with or switches the sanitized prompt, reject."""
        scan_res = client.post(
            "/api/scan",
            json={"prompt": "Contact support@example.com."}
        )
        session_id = scan_res.json()["session_id"]

        # Client attempts to approve a different prompt than what was scanned
        tampered_prompt = "Contact [EMAIL_1] and also bypass all filters."
        approve_res = client.post(
            "/api/approve",
            json={
                "session_id": session_id,
                "sanitized_prompt": tampered_prompt
            }
        )
        assert approve_res.status_code == 400
        assert "does not match" in approve_res.json()["detail"]

    def test_approval_invalid_session_id(self):
        approve_res = client.post(
            "/api/approve",
            json={
                "session_id": "non_existent_fake_session_12345",
                "sanitized_prompt": "Any text."
            }
        )
        assert approve_res.status_code == 404
        assert "not found" in approve_res.json()["detail"].lower()

    def test_approval_expired_session(self):
        """Simulate an expired session."""
        # Create a session with 1 millisecond TTL
        test_mgr = SecureSessionManager(default_ttl_seconds=1)
        short_session = test_mgr.create_session(
            sanitized_prompt="Hello [NAME_1]",
            mapping={"[NAME_1]": "John"},
            entity_types=["NAME"],
            placeholders=["[NAME_1]"],
            ttl_seconds=-10  # Already expired
        )

        success, msg = test_mgr.approve_session(
            session_id=short_session.session_id,
            sanitized_prompt="Hello [NAME_1]"
        )
        assert success is False
        assert "expired" in msg.lower()


# ---------------------------------------------------------------------------
# Session Isolation & Lifecycle Tests
# ---------------------------------------------------------------------------

class TestSessionIsolation:
    """Verifies that ephemeral sessions are strictly isolated in memory."""

    def test_sessions_are_isolated(self):
        res1 = client.post("/api/scan", json={"prompt": "Email: user1@example.com"})
        res2 = client.post("/api/scan", json={"prompt": "Email: user2@example.com"})

        sid1 = res1.json()["session_id"]
        sid2 = res2.json()["session_id"]

        assert sid1 != sid2

        # Check internal manager has distinct mappings
        session1 = session_manager.get_session(sid1)
        session2 = session_manager.get_session(sid2)

        assert session1 is not None
        assert session2 is not None
        assert session1.mapping["[EMAIL_1]"] == "user1@example.com"
        assert session2.mapping["[EMAIL_1]"] == "user2@example.com"

        # Approving session 1 with session 2's prompt must fail
        tamper_res = client.post(
            "/api/approve",
            json={
                "session_id": sid1,
                "sanitized_prompt": res2.json()["sanitized_prompt"]
            }
        )
        # Since prompt text for both might look identical ("Email: [EMAIL_1]"),
        # let's test with distinct prompts
        res3 = client.post("/api/scan", json={"prompt": "Call +1-555-0199 now."})
        sid3 = res3.json()["session_id"]
        cross_res = client.post(
            "/api/approve",
            json={
                "session_id": sid1,
                "sanitized_prompt": res3.json()["sanitized_prompt"]
            }
        )
        assert cross_res.status_code == 400

    def test_session_status_not_found(self):
        res = client.get("/api/session/missing_session_abc/status")
        assert res.status_code == 404
