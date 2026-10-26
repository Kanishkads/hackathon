"""Automated tests for Phase 3B: AI Response Placeholder Validation and Safe Restoration.

Tests:
- Accurate restoration of valid placeholders ([EMAIL_1], [PHONE_1], [API_KEY_1], [PASSWORD_1]).
- Repeated placeholders in response text.
- Rejection/flagging of unknown/hallucinated placeholders (e.g. [EMAIL_99]).
- Safe handling of malformed placeholders.
- Strict server-side approval check (unapproved sessions fail with 403).
- Session expiration check (expired sessions fail with 404).
- Cross-session isolation (Session A cannot unmask with Session B's mapping).
- Safe string representation and zero leakage in warnings/repr.
"""

from pathlib import Path
import sys

# Ensure backend package is in python path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient
import pytest

from app.core.session import session_manager
from app.engine.unmasker import ResponseUnmasker
from app.main import app

client = TestClient(app)


# ---------------------------------------------------------------------------
# Test Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def scanned_and_approved_session():
    """Sets up an approved session with email and phone mappings."""
    raw_prompt = "Contact alice@example.com or reach +1-555-0199."
    scan_res = client.post("/api/scan", json={"prompt": raw_prompt})
    assert scan_res.status_code == 200
    scan_data = scan_res.json()
    session_id = scan_data["session_id"]
    sanitized_prompt = scan_data["sanitized_prompt"]

    approve_res = client.post(
        "/api/approve",
        json={"session_id": session_id, "sanitized_prompt": sanitized_prompt}
    )
    assert approve_res.status_code == 200

    return session_id, "alice@example.com", "+1-555-0199"


# ---------------------------------------------------------------------------
# Unit Tests for ResponseUnmasker Engine
# ---------------------------------------------------------------------------

class TestResponseUnmaskerEngine:
    """Direct unit tests for ResponseUnmasker engine logic."""

    def test_unmask_valid_placeholders(self):
        unmasker = ResponseUnmasker()
        mapping = {
            "[EMAIL_1]": "alice@example.com",
            "[PHONE_1]": "+1-555-0199"
        }
        text = "I received the request for [EMAIL_1]. I will call [PHONE_1] shortly."
        res = unmasker.unmask(text, mapping)

        assert res.restored_text == "I received the request for alice@example.com. I will call +1-555-0199 shortly."
        assert "[EMAIL_1]" in res.restored_placeholders
        assert "[PHONE_1]" in res.restored_placeholders
        assert len(res.unrecognized_placeholders) == 0

    def test_unmask_repeated_placeholders(self):
        unmasker = ResponseUnmasker()
        mapping = {"[EMAIL_1]": "alice@example.com"}
        text = "First notification to [EMAIL_1], second notification to [EMAIL_1]."
        res = unmasker.unmask(text, mapping)

        assert res.restored_text == "First notification to alice@example.com, second notification to alice@example.com."
        assert res.restored_placeholders == ["[EMAIL_1]"]

    def test_hallucinated_placeholder_flagged_and_unrestored(self):
        unmasker = ResponseUnmasker()
        mapping = {"[EMAIL_1]": "alice@example.com"}
        # AI hallucinated [EMAIL_99] which is NOT in mapping
        text = "Send confirmation to [EMAIL_1] and forward copy to [EMAIL_99]."
        res = unmasker.unmask(text, mapping)

        # [EMAIL_1] is restored, [EMAIL_99] is preserved intact!
        assert "alice@example.com" in res.restored_text
        assert "[EMAIL_99]" in res.restored_text
        assert "[EMAIL_99]" in res.unrecognized_placeholders
        assert len(res.warnings) > 0
        assert "EMAIL_99" in res.warnings[0]

    def test_malformed_placeholder_flagged_and_unrestored(self):
        unmasker = ResponseUnmasker()
        mapping = {"[EMAIL_1]": "alice@example.com"}
        text = "Invalid tokens: [EMAIL_] and [PHONE_abc]."
        res = unmasker.unmask(text, mapping)

        assert "[EMAIL_]" in res.restored_text
        assert "[PHONE_abc]" in res.restored_text
        assert len(res.malformed_placeholders) >= 1

    def test_safe_repr_redacts_restored_text(self):
        unmasker = ResponseUnmasker()
        mapping = {"[PASSWORD_1]": "SuperSecretPass123!"}
        res = unmasker.unmask("Password is [PASSWORD_1]", mapping)

        repr_str = repr(res)
        assert "SuperSecretPass123!" not in repr_str
        assert "restored_placeholders=['[PASSWORD_1]']" in repr_str


# ---------------------------------------------------------------------------
# Integration Tests for POST /api/unmask
# ---------------------------------------------------------------------------

class TestUnmaskEndpoint:
    """Integration tests for the /api/unmask API endpoint."""

    def test_successful_unmask(self, scanned_and_approved_session):
        session_id, email, phone = scanned_and_approved_session

        ai_response = "I have logged the ticket for [EMAIL_1] and scheduled a callback to [PHONE_1]."
        res = client.post(
            "/api/unmask",
            json={
                "session_id": session_id,
                "sanitized_response": ai_response
            }
        )
        assert res.status_code == 200
        data = res.json()

        assert email in data["restored_text"]
        assert phone in data["restored_text"]
        assert "[EMAIL_1]" in data["restored_placeholders"]
        assert "[PHONE_1]" in data["restored_placeholders"]
        assert data["unrecognized_placeholders"] == []

    def test_unmask_with_hallucinated_placeholder(self, scanned_and_approved_session):
        session_id, email, _ = scanned_and_approved_session

        ai_response = "Contacting [EMAIL_1] and unmapped [PHONE_42]."
        res = client.post(
            "/api/unmask",
            json={
                "session_id": session_id,
                "sanitized_response": ai_response
            }
        )
        assert res.status_code == 200
        data = res.json()

        assert email in data["restored_text"]
        assert "[PHONE_42]" in data["restored_text"]  # Unrecognized placeholder remains
        assert "[PHONE_42]" in data["unrecognized_placeholders"]
        assert len(data["warnings"]) > 0

    def test_unmask_unapproved_session_rejected(self):
        # 1. Scan prompt but do NOT approve it
        scan_res = client.post("/api/scan", json={"prompt": "Email dev@example.com"})
        session_id = scan_res.json()["session_id"]

        # 2. Attempt unmasking without prior approval
        res = client.post(
            "/api/unmask",
            json={
                "session_id": session_id,
                "sanitized_response": "Hello [EMAIL_1]"
            }
        )
        assert res.status_code == 403
        assert "Approval required" in res.json()["detail"]

    def test_unmask_missing_session_rejected(self):
        res = client.post(
            "/api/unmask",
            json={
                "session_id": "non_existent_session_12345",
                "sanitized_response": "Hello [EMAIL_1]"
            }
        )
        assert res.status_code == 404
        assert "not found" in res.json()["detail"].lower()

    def test_unmask_expired_session_rejected(self):
        # Create an expired approved session
        expired = session_manager.create_session(
            sanitized_prompt="Hello [EMAIL_1]",
            mapping={"[EMAIL_1]": "test@example.com"},
            entity_types=["EMAIL"],
            placeholders=["[EMAIL_1]"],
            ttl_seconds=-10
        )
        expired.is_approved = True

        res = client.post(
            "/api/unmask",
            json={
                "session_id": expired.session_id,
                "sanitized_response": "Contact [EMAIL_1]"
            }
        )
        assert res.status_code == 404
        assert "expired" in res.json()["detail"].lower()

    def test_unmask_empty_input_rejected(self, scanned_and_approved_session):
        session_id, _, _ = scanned_and_approved_session

        res = client.post(
            "/api/unmask",
            json={
                "session_id": session_id,
                "sanitized_response": "   "
            }
        )
        assert res.status_code == 400
        assert "empty or whitespace" in res.json()["detail"]

    def test_cross_session_isolation(self):
        """Session A must not be able to unmask using Session B's mapping."""
        # Create Session A with Alice
        scan_a = client.post("/api/scan", json={"prompt": "Alice: alice@example.com"})
        sid_a = scan_a.json()["session_id"]
        client.post("/api/approve", json={"session_id": sid_a, "sanitized_prompt": scan_a.json()["sanitized_prompt"]})

        # Create Session B with Bob
        scan_b = client.post("/api/scan", json={"prompt": "Bob: bob@example.com"})
        sid_b = scan_b.json()["session_id"]
        client.post("/api/approve", json={"session_id": sid_b, "sanitized_prompt": scan_b.json()["sanitized_prompt"]})

        # Unmasking Session A with [EMAIL_1] restores Alice, never Bob
        res_a = client.post("/api/unmask", json={"session_id": sid_a, "sanitized_response": "Resolved for [EMAIL_1]"})
        assert "alice@example.com" in res_a.json()["restored_text"]
        assert "bob@example.com" not in res_a.json()["restored_text"]

        # Unmasking Session B with [EMAIL_1] restores Bob, never Alice
        res_b = client.post("/api/unmask", json={"session_id": sid_b, "sanitized_response": "Resolved for [EMAIL_1]"})
        assert "bob@example.com" in res_b.json()["restored_text"]
        assert "alice@example.com" not in res_b.json()["restored_text"]
