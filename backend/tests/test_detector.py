"""Unit tests for SensitiveEntityDetector.

All test inputs use synthetic, fictional data to maintain privacy and security.
"""

from pathlib import Path
import sys

# Ensure backend package is in python path for test execution
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest
from app.engine.detector import (
    Confidence,
    DetectedEntity,
    EntityType,
    SensitiveEntityDetector,
)


@pytest.fixture
def detector() -> SensitiveEntityDetector:
    """Fixture providing a fresh instance of SensitiveEntityDetector."""
    return SensitiveEntityDetector()


class TestEmailDetection:
    """Tests for email detection rules."""

    def test_valid_emails(self, detector: SensitiveEntityDetector):
        sample = (
            "Contact team at support@example.com or lead.dev+filter@sub.domain.org "
            "for inquiries."
        )
        entities = detector.detect(sample)
        email_entities = [e for e in entities if e.entity_type == EntityType.EMAIL.value]

        assert len(email_entities) == 2
        assert email_entities[0].value == "support@example.com"
        assert email_entities[0].confidence == Confidence.HIGH.value
        assert email_entities[1].value == "lead.dev+filter@sub.domain.org"
        assert email_entities[1].confidence == Confidence.HIGH.value

    def test_invalid_or_non_emails(self, detector: SensitiveEntityDetector):
        sample = "Here are invalid candidates: @example.com, user@.com, plain_text, hello@domain..com"
        entities = detector.detect(sample)
        email_entities = [e for e in entities if e.entity_type == EntityType.EMAIL.value]
        assert len(email_entities) == 0


class TestPhoneDetection:
    """Tests for domestic and international phone number detection."""

    def test_valid_phone_formats(self, detector: SensitiveEntityDetector):
        sample = (
            "Call our office at +1-555-0199 or mobile (555) 018-4321, "
            "or international +44 20 7946 0958."
        )
        entities = detector.detect(sample)
        phone_entities = [e for e in entities if e.entity_type == EntityType.PHONE.value]

        assert len(phone_entities) == 3
        values = [e.value for e in phone_entities]
        assert "+1-555-0199" in values
        assert "(555) 018-4321" in values
        assert "+44 20 7946 0958" in values
        for p in phone_entities:
            assert p.confidence == Confidence.HIGH.value

    def test_non_phone_numbers_ignored(self, detector: SensitiveEntityDetector):
        # Dates, semantic versions, and IP addresses must not be detected as phones
        sample = (
            "Meeting on 2026-10-26 with version 3.12.10 on server 192.168.1.1 "
            "costing 12345 dollars."
        )
        entities = detector.detect(sample)
        phone_entities = [e for e in entities if e.entity_type == EntityType.PHONE.value]
        assert len(phone_entities) == 0


class TestApiKeyDetection:
    """Tests for vendor-specific API keys and generic tokens."""

    def test_synthetic_openai_key(self, detector: SensitiveEntityDetector):
        sample = "Export OPENAI_API_KEY=sk-proj-fictional1234567890abcdef1234567890 in env."
        entities = detector.detect(sample)
        keys = [e for e in entities if e.entity_type == EntityType.API_KEY.value]

        assert len(keys) == 1
        assert keys[0].value == "sk-proj-fictional1234567890abcdef1234567890"
        assert keys[0].confidence == Confidence.HIGH.value

    def test_synthetic_aws_and_github_tokens(self, detector: SensitiveEntityDetector):
        sample = "AWS: AKIAIOSFODNN7EXAMPLE, GitHub: ghp_fictionaltoken1234567890abcdef123456"
        entities = detector.detect(sample)
        keys = [e for e in entities if e.entity_type == EntityType.API_KEY.value]

        assert len(keys) == 2
        values = [k.value for k in keys]
        assert "AKIAIOSFODNN7EXAMPLE" in values
        assert "ghp_fictionaltoken1234567890abcdef123456" in values

    def test_bearer_token(self, detector: SensitiveEntityDetector):
        sample = "Authorization: Bearer synthetic_bearer_token_1234567890_abcdef"
        entities = detector.detect(sample)
        keys = [e for e in entities if e.entity_type == EntityType.API_KEY.value]

        assert len(keys) == 1
        assert keys[0].value == "synthetic_bearer_token_1234567890_abcdef"
        assert keys[0].confidence == Confidence.HIGH.value

    def test_generic_api_key_assignment(self, detector: SensitiveEntityDetector):
        sample = 'client_secret = "fictional_client_secret_98765432101234"'
        entities = detector.detect(sample)
        keys = [e for e in entities if e.entity_type == EntityType.API_KEY.value]

        assert len(keys) == 1
        assert keys[0].value == "fictional_client_secret_98765432101234"


class TestPasswordDetection:
    """Tests for password-like assignments."""

    def test_password_assignments(self, detector: SensitiveEntityDetector):
        sample = 'database_password = "SyntheticDbPass456!" and db_pass: "LocalTestKey789"'
        entities = detector.detect(sample)
        passwords = [e for e in entities if e.entity_type == EntityType.PASSWORD.value]

        assert len(passwords) == 2
        values = [p.value for p in passwords]
        assert "SyntheticDbPass456!" in values
        assert "LocalTestKey789" in values
        assert passwords[0].confidence == Confidence.HIGH.value

    def test_placeholder_passwords_ignored(self, detector: SensitiveEntityDetector):
        sample = 'password = "your_password_here" and db_pass = null'
        entities = detector.detect(sample)
        passwords = [e for e in entities if e.entity_type == EntityType.PASSWORD.value]
        assert len(passwords) == 0

class TestPersonDetection:
    """Tests for personal name detection and false-positive avoidance."""

    def test_honorific_titles(self, detector: SensitiveEntityDetector):
        sample = "Please arrange a consultation with Dr. Jane Doe and Mr. John Smith."
        entities = detector.detect(sample)
        person_entities = [e for e in entities if e.entity_type == EntityType.PERSON.value]

        assert len(person_entities) == 2
        names = [e.value for e in person_entities]
        assert "Jane Doe" in names
        assert "John Smith" in names
        for e in person_entities:
            assert e.confidence == Confidence.HIGH.value

    def test_contextual_declarations(self, detector: SensitiveEntityDetector):
        sample = "Hello, my name is Alice Walker. The attending physician was Dr. Robert Taylor."
        entities = detector.detect(sample)
        person_entities = [e for e in entities if e.entity_type == EntityType.PERSON.value]

        assert len(person_entities) >= 2
        names = [e.value for e in person_entities]
        assert "Alice Walker" in names
        assert "Robert Taylor" in names

    def test_common_non_person_terms_ignored(self, detector: SensitiveEntityDetector):
        sample = "We use LocalShield AI on Monday to query Google Gemini and Anthropic Claude."
        entities = detector.detect(sample)
        person_entities = [e for e in entities if e.entity_type == EntityType.PERSON.value]
        # Common terms in IGNORED_NAME_WORDS or brand terms must not be detected as persons
        person_values = [e.value for e in person_entities]
        assert "LocalShield AI" not in person_values
        assert "Monday" not in person_values

    def test_mixed_sensitive_entities_detection(self, detector: SensitiveEntityDetector):
        sample = (
            "Contact Dr. Alan Turing at alan.turing@bletchley.org or +1-555-0144. "
            "Use apiKey: 'sk-proj-testkey1234567890abcdef' with password = 'EnigmaSecret123'."
        )
        entities = detector.detect(sample)
        types = {e.entity_type for e in entities}
        assert EntityType.PERSON.value in types
        assert EntityType.EMAIL.value in types
        assert EntityType.PHONE.value in types
        assert EntityType.API_KEY.value in types
        assert EntityType.PASSWORD.value in types



class TestEdgeCasesAndSafety:
    """Tests for edge cases, non-sensitive text, repeated values, and safety."""

    def test_non_sensitive_text(self, detector: SensitiveEntityDetector):
        sample = "Summarize the difference between synchronous and asynchronous Python."
        entities = detector.detect(sample)
        assert len(entities) == 0

    def test_repeated_values_detected_separately(self, detector: SensitiveEntityDetector):
        sample = "Email alice@example.com now. If unreachable, retry alice@example.com."
        entities = detector.detect(sample)

        assert len(entities) == 2
        assert entities[0].value == "alice@example.com"
        assert entities[1].value == "alice@example.com"
        assert entities[0].start != entities[1].start

    def test_overlapping_matches_resolved(self, detector: SensitiveEntityDetector):
        # A specific OpenAI key pattern inside a generic api_key assignment
        sample = 'api_key = "sk-proj-fictional1234567890abcdef1234567890"'
        entities = detector.detect(sample)

        # Should produce only one resolved entity, not two overlapping ones
        assert len(entities) == 1
        assert entities[0].value == "sk-proj-fictional1234567890abcdef1234567890"
        assert entities[0].entity_type == EntityType.API_KEY.value

    def test_safe_repr_does_not_leak_sensitive_values(self, detector: SensitiveEntityDetector):
        entity = DetectedEntity(
            entity_type="PASSWORD",
            value="TopSecret123!",
            start=10,
            end=23,
            confidence="HIGH",
            rule_name="password_assignment"
        )
        repr_str = repr(entity)
        assert "TopSecret123!" not in repr_str
        assert "len=13" in repr_str
