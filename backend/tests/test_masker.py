"""Unit tests for Sensitive Value Masker.

Verifies placeholder generation, repeated value handling, left-to-right replacement,
and safe string representation. All data is synthetic and fictional.
"""

from pathlib import Path
import sys

# Ensure backend package is in python path for test execution
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest
from app.engine.masker import MaskResult, Masker


@pytest.fixture
def masker() -> Masker:
    """Fixture providing a fresh Masker instance."""
    return Masker()


class TestMaskerPlaceholders:
    """Tests for placeholder format, numbering, and replacement accuracy."""

    def test_single_value_masking(self, masker: Masker):
        sample = "Please send invoice to finance@example.com immediately."
        result = masker.mask(sample)

        assert result.sanitized_text == "Please send invoice to [EMAIL_1] immediately."
        assert result.mapping == {"[EMAIL_1]": "finance@example.com"}
        assert result.stats == {"EMAIL": 1}

    def test_distinct_values_get_sequential_placeholders(self, masker: Masker):
        sample = "Contact support@example.com or admin@example.com for access."
        result = masker.mask(sample)

        assert result.sanitized_text == "Contact [EMAIL_1] or [EMAIL_2] for access."
        assert result.mapping["[EMAIL_1]"] == "support@example.com"
        assert result.mapping["[EMAIL_2]"] == "admin@example.com"
        assert result.stats == {"EMAIL": 2}

    def test_repeated_values_share_same_placeholder(self, masker: Masker):
        sample = (
            "Reach out to dev@example.com. Remember, dev@example.com is monitored 24/7."
        )
        result = masker.mask(sample)

        # Both occurrences of dev@example.com must be replaced with [EMAIL_1]
        assert result.sanitized_text == (
            "Reach out to [EMAIL_1]. Remember, [EMAIL_1] is monitored 24/7."
        )
        assert result.mapping == {"[EMAIL_1]": "dev@example.com"}
        assert result.stats == {"EMAIL": 2}  # 2 masked instances

    def test_mixed_entity_types_and_repetition(self, masker: Masker):
        sample = (
            "Alice: alice@example.com, phone: +1-555-0199. "
            "Bob: bob@example.com, emergency phone: +1-555-0199."
        )
        result = masker.mask(sample)

        assert "[EMAIL_1]" in result.sanitized_text
        assert "[EMAIL_2]" in result.sanitized_text
        assert "[PHONE_1]" in result.sanitized_text

        # Phone number is repeated, so [PHONE_2] should not exist
        assert "[PHONE_2]" not in result.sanitized_text
        assert result.sanitized_text.count("[PHONE_1]") == 2
        assert result.mapping["[EMAIL_1]"] == "alice@example.com"
        assert result.mapping["[EMAIL_2]"] == "bob@example.com"
        assert result.mapping["[PHONE_1]"] == "+1-555-0199"

    def test_api_key_and_password_masking(self, masker: Masker):
        sample = (
            'Config:\n'
            'api_key = "sk-proj-fictional1234567890abcdef1234567890"\n'
            'password = "SyntheticSecretPass123!"'
        )
        result = masker.mask(sample)

        assert '[API_KEY_1]' in result.sanitized_text
        assert '[PASSWORD_1]' in result.sanitized_text
        assert 'sk-proj-' not in result.sanitized_text
        assert 'SyntheticSecretPass123!' not in result.sanitized_text
        assert result.mapping['[API_KEY_1]'] == "sk-proj-fictional1234567890abcdef1234567890"
        assert result.mapping['[PASSWORD_1]'] == "SyntheticSecretPass123!"


class TestMaskerEdgeCases:
    """Tests for edge cases and input validation."""

    def test_text_without_sensitive_values(self, masker: Masker):
        sample = "Explain how quicksort works with an example in Python."
        result = masker.mask(sample)

        assert result.sanitized_text == sample
        assert result.mapping == {}
        assert result.stats == {}
        assert len(result.entities) == 0

    def test_empty_string(self, masker: Masker):
        result = masker.mask("")
        assert result.sanitized_text == ""
        assert result.mapping == {}
        assert result.stats == {}

    def test_safe_repr_redacts_mapping(self, masker: Masker):
        sample = "Email: secret.agent@example.com"
        result = masker.mask(sample)
        repr_output = repr(result)

        assert "secret.agent@example.com" not in repr_output
        assert "[REDACTED]" in repr_output
        assert "[EMAIL_1]" in repr_output
