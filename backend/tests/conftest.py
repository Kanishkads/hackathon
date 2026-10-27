"""LocalShield AI - Pytest Configuration and Global Fixtures.

Ensures that automated tests default to offline MOCK provider mode
without network calls or external credential dependencies.
"""

import pytest
from app.core import config


@pytest.fixture(autouse=True)
def default_mock_provider(monkeypatch):
    """Enforces default offline mock mode across all test modules unless explicitly patched."""
    monkeypatch.setattr(config, "AI_PROVIDER", "mock")
    monkeypatch.setattr(config, "AI_MODEL", "mock-llama-3")
