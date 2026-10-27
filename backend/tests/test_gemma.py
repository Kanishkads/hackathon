"""Automated tests for Stage 1: Real Gemma 4 Model Integration.

Verifies:
- Gemma 4 provider initialization, model validation, and configuration.
- Google AI Studio native REST endpoint integration and payload formatting.
- OpenAI-compatible runtime integration (OpenRouter, Ollama, etc.).
- Robust error handling (missing credentials, unsupported model IDs, network errors, timeouts).
- Zero-leak guarantee: unmasked sensitive data is never sent to the model provider.
- Live vs Mock distinction: never returns fake/mock responses when LIVE mode fails.
- Real provider connectivity verification endpoint (/api/provider/test).
"""

from pathlib import Path
import sys
from unittest.mock import AsyncMock, patch

# Ensure backend package is in python path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient
import httpx
import pytest

from app.core import config
from app.main import app
from app.services.ai_client import (
    AIProviderConfigError,
    AIProviderError,
    AIProviderTimeoutError,
    GemmaAIProvider,
    get_ai_provider,
)

client = TestClient(app)


# ---------------------------------------------------------------------------
# Provider Initialization & Configuration Tests
# ---------------------------------------------------------------------------

class TestGemmaProviderConfig:
    """Tests for model validation, credentials enforcement, and safe representation."""

    def test_valid_gemma_models_accepted(self):
        valid_models = [
            "gemma-4-26b-a4b-it",
            "gemma-4-31b-it",
            "google/gemma-4-26b-a4b-it",
            "google/gemma-4-31b-it",
            "gemma4",
            "gemma-4-e2b-it",
        ]
        for model in valid_models:
            provider = GemmaAIProvider(
                api_key="test-api-key",
                api_url="https://generativelanguage.googleapis.com/v1beta",
                model_name=model,
            )
            assert provider.model_name == model
            assert provider.provider_name == "gemma"
            assert provider.is_mock is False

    def test_unsupported_model_rejected(self):
        with pytest.raises(AIProviderConfigError) as exc_info:
            GemmaAIProvider(
                api_key="test-key",
                api_url="https://generativelanguage.googleapis.com/v1beta",
                model_name="unsupported-llama-or-gpt-model",
            )
        assert "Unsupported model identifier" in str(exc_info.value)
        assert "Gemma 4" in str(exc_info.value)

    def test_missing_api_key_for_cloud_endpoint_rejected(self):
        with pytest.raises(AIProviderConfigError) as exc_info:
            GemmaAIProvider(
                api_key=None,
                api_url="https://generativelanguage.googleapis.com/v1beta",
                model_name="gemma-4-26b-a4b-it",
            )
        assert "requires an API key" in str(exc_info.value)

    def test_localhost_endpoint_does_not_require_api_key(self):
        # Local Ollama or LiteRT does not require an API key
        provider = GemmaAIProvider(
            api_key=None,
            api_url="http://localhost:11434/v1",
            model_name="gemma4",
        )
        assert provider.model_name == "gemma4"
        assert provider.is_mock is False

    def test_safe_repr_redacts_credentials(self):
        provider = GemmaAIProvider(
            api_key="AIzaSySuperSecretGoogleApiKey12345",
            api_url="https://generativelanguage.googleapis.com/v1beta",
            model_name="gemma-4-26b-a4b-it",
        )
        repr_str = repr(provider)
        assert "AIzaSySuperSecretGoogleApiKey12345" not in repr_str
        assert "***" in repr_str


# ---------------------------------------------------------------------------
# Google AI Studio Native REST Endpoint Tests
# ---------------------------------------------------------------------------

class TestGemmaGenerationGoogleNative:
    """Tests for Google AI Studio native generateContent integration."""

    @pytest.mark.anyio
    async def test_google_native_generation_success(self):
        provider = GemmaAIProvider(
            api_key="test-google-key",
            api_url="https://generativelanguage.googleapis.com/v1beta",
            model_name="gemma-4-26b-a4b-it",
        )

        fake_response_data = {
            "candidates": [
                {
                    "content": {
                        "parts": [
                            {"text": "Hello, I acknowledged [EMAIL_1] and [PHONE_1] safely."}
                        ],
                        "role": "model",
                    },
                    "finishReason": "STOP",
                }
            ]
        }

        mock_response = httpx.Response(
            status_code=200,
            json=fake_response_data,
            request=httpx.Request("POST", "https://generativelanguage.googleapis.com/v1beta"),
        )

        with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
            mock_post.return_value = mock_response

            result = await provider.generate("Process request for [EMAIL_1] and [PHONE_1]")

            assert "acknowledged [EMAIL_1]" in result
            mock_post.assert_called_once()

            # Verify outbound call properties
            call_kwargs = mock_post.call_args.kwargs
            endpoint = mock_post.call_args.args[0]
            assert "gemma-4-26b-a4b-it:generateContent" in endpoint
            assert call_kwargs["headers"]["x-goog-api-key"] == "test-google-key"
            payload = call_kwargs["json"]
            assert payload["contents"][0]["parts"][0]["text"] == "Process request for [EMAIL_1] and [PHONE_1]"

    @pytest.mark.anyio
    async def test_google_native_upstream_error_handling(self):
        provider = GemmaAIProvider(
            api_key="test-google-key",
            api_url="https://generativelanguage.googleapis.com/v1beta",
            model_name="gemma-4-26b-a4b-it",
        )

        error_response_data = {
            "error": {
                "code": 403,
                "message": "Resource has been exhausted (quota exceeded).",
                "status": "RESOURCE_EXHAUSTED",
            }
        }
        mock_response = httpx.Response(
            status_code=403,
            json=error_response_data,
            request=httpx.Request("POST", "https://generativelanguage.googleapis.com/v1beta"),
        )

        with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
            mock_post.return_value = mock_response

            with pytest.raises(AIProviderError) as exc_info:
                await provider.generate("Test prompt")

            assert "HTTP 403" in str(exc_info.value)
            assert "Resource has been exhausted" in str(exc_info.value)


# ---------------------------------------------------------------------------
# OpenAI-Compatible / OpenRouter Endpoint Tests
# ---------------------------------------------------------------------------

class TestGemmaGenerationOpenAICompatible:
    """Tests for OpenAI-compatible Gemma 4 endpoints (OpenRouter, Ollama, etc.)."""

    @pytest.mark.anyio
    async def test_openai_compatible_generation_success(self):
        provider = GemmaAIProvider(
            api_key="sk-or-test-key",
            api_url="https://openrouter.ai/api/v1",
            model_name="google/gemma-4-31b-it",
        )

        fake_response_data = {
            "choices": [
                {
                    "message": {
                        "role": "assistant",
                        "content": "Gemma 4 processed [API_KEY_1] intact.",
                    }
                }
            ]
        }
        mock_response = httpx.Response(
            status_code=200,
            json=fake_response_data,
            request=httpx.Request("POST", "https://openrouter.ai/api/v1/chat/completions"),
        )

        with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
            mock_post.return_value = mock_response

            result = await provider.generate("Handle token [API_KEY_1]")
            assert "[API_KEY_1]" in result

            call_kwargs = mock_post.call_args.kwargs
            assert call_kwargs["headers"]["Authorization"] == "Bearer sk-or-test-key"
            assert call_kwargs["json"]["model"] == "google/gemma-4-31b-it"

    @pytest.mark.anyio
    async def test_timeout_maps_to_provider_timeout_error(self):
        provider = GemmaAIProvider(
            api_key="test-key",
            api_url="https://openrouter.ai/api/v1",
            model_name="google/gemma-4-31b-it",
        )

        with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
            mock_post.side_effect = httpx.TimeoutException("Timed out")

            with pytest.raises(AIProviderTimeoutError) as exc_info:
                await provider.generate("Test prompt")
            assert "timed out" in str(exc_info.value).lower()

    @pytest.mark.anyio
    async def test_network_error_maps_to_provider_error(self):
        provider = GemmaAIProvider(
            api_key="test-key",
            api_url="https://openrouter.ai/api/v1",
            model_name="google/gemma-4-31b-it",
        )

        with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
            mock_post.side_effect = httpx.RequestError("Connection refused")

            with pytest.raises(AIProviderError) as exc_info:
                await provider.generate("Test prompt")
            assert "Failed to connect" in str(exc_info.value)


# ---------------------------------------------------------------------------
# Privacy, Zero-Leak & Fail-Closed Assertions
# ---------------------------------------------------------------------------

class TestGemmaPrivacyAndZeroLeak:
    """Verifies that original unmasked secrets are NEVER transmitted to the AI provider."""

    def test_unmasked_secrets_never_sent_to_gemma_provider(self):
        raw_prompt = "Contact user alice@example.com, call +1-555-0199 with db_pass=SecretPass987!"

        # 1. Scan prompt to detect and mask entities
        scan_res = client.post("/api/scan", json={"prompt": raw_prompt})
        assert scan_res.status_code == 200
        scan_data = scan_res.json()
        session_id = scan_data["session_id"]
        sanitized_prompt = scan_data["sanitized_prompt"]

        # Ensure placeholders exist in sanitized text
        assert "[EMAIL_1]" in sanitized_prompt
        assert "[PHONE_1]" in sanitized_prompt
        assert "alice@example.com" not in sanitized_prompt

        # 2. Server-side approval
        approve_res = client.post(
            "/api/approve",
            json={"session_id": session_id, "sanitized_prompt": sanitized_prompt},
        )
        assert approve_res.status_code == 200

        # 3. Forward with Gemma provider active
        mock_gemma = AsyncMock(spec=GemmaAIProvider)
        mock_gemma.provider_name = "gemma"
        mock_gemma.model_name = "gemma-4-26b-a4b-it"
        mock_gemma.is_mock = False
        mock_gemma.generate.return_value = "Response acknowledging [EMAIL_1] and [PHONE_1]."

        with patch("app.api.routes.get_ai_provider", return_value=mock_gemma):
            forward_res = client.post(
                "/api/forward",
                json={"session_id": session_id, "sanitized_prompt": sanitized_prompt},
            )
            assert forward_res.status_code == 200
            data = forward_res.json()

            assert data["is_mock"] is False
            assert data["provider"] == "gemma"
            assert data["model"] == "gemma-4-26b-a4b-it"

            # Strict assertion: Provider generate() called ONLY with sanitized prompt
            mock_gemma.generate.assert_called_once()
            called_prompt = mock_gemma.generate.call_args.args[0]

            assert "alice@example.com" not in called_prompt
            assert "+1-555-0199" not in called_prompt
            assert "SecretPass987!" not in called_prompt
            assert "[EMAIL_1]" in called_prompt
            assert "[PHONE_1]" in called_prompt

    def test_never_returns_fake_response_when_live_mode_fails(self):
        """Rule 6: Never return a fake response when LIVE mode fails."""
        mock_gemma = AsyncMock(spec=GemmaAIProvider)
        mock_gemma.provider_name = "gemma"
        mock_gemma.model_name = "gemma-4-26b-a4b-it"
        mock_gemma.is_mock = False
        mock_gemma.generate.side_effect = AIProviderError("Upstream API quota exceeded.")

        raw_prompt = "Contact admin@example.com immediately."
        scan_res = client.post("/api/scan", json={"prompt": raw_prompt})
        session_id = scan_res.json()["session_id"]
        sanitized_prompt = scan_res.json()["sanitized_prompt"]
        client.post("/api/approve", json={"session_id": session_id, "sanitized_prompt": sanitized_prompt})

        with patch("app.api.routes.get_ai_provider", return_value=mock_gemma):
            forward_res = client.post(
                "/api/forward",
                json={"session_id": session_id, "sanitized_prompt": sanitized_prompt},
            )
            # Must return HTTP 502 error, NEVER return a fake mock string!
            assert forward_res.status_code == 502
            assert "communication error" in forward_res.json()["detail"].lower()
            assert "[LocalShield Mock AI Response]" not in forward_res.text


# ---------------------------------------------------------------------------
# Real Model Connectivity Verification Tests (/api/provider/test)
# ---------------------------------------------------------------------------

class TestProviderConnectivityEndpoint:
    """Verifies that /api/provider/test executes real connectivity checks."""

    def test_provider_test_mock_mode(self):
        with patch.object(config, "AI_PROVIDER", "mock"):
            res = client.get("/api/provider/test")
            assert res.status_code == 200
            data = res.json()
            assert data["connected"] is True
            assert data["provider"] == "mock"
            assert data["is_mock"] is True

    def test_provider_test_live_gemma_success(self):
        mock_gemma = AsyncMock(spec=GemmaAIProvider)
        mock_gemma.provider_name = "gemma"
        mock_gemma.model_name = "gemma-4-26b-a4b-it"
        mock_gemma.is_mock = False
        mock_gemma.test_connectivity.return_value = {
            "status": "connected",
            "connected": True,
            "provider": "gemma",
            "model": "gemma-4-26b-a4b-it",
            "is_mock": False,
            "latency_ms": 115,
            "sample_response": "Gemma 4 model connectivity probe verified.",
        }

        with patch("app.api.routes.get_ai_provider", return_value=mock_gemma):
            res = client.post("/api/provider/test")
            assert res.status_code == 200
            data = res.json()
            assert data["connected"] is True
            assert data["provider"] == "gemma"
            assert data["is_mock"] is False
            assert data["latency_ms"] == 115
            assert "Gemma 4" in data["sample_response"]

    def test_provider_test_missing_credentials_returns_503(self):
        with patch.object(config, "AI_PROVIDER", "gemma"), \
             patch.object(config, "AI_API_KEY", None), \
             patch.object(config, "AI_API_URL", "https://generativelanguage.googleapis.com/v1beta"):
            res = client.get("/api/provider/test")
            assert res.status_code == 503
            assert "requires an API key" in res.json()["detail"]

    def test_provider_test_timeout_returns_504(self):
        mock_gemma = AsyncMock(spec=GemmaAIProvider)
        mock_gemma.test_connectivity.side_effect = AIProviderTimeoutError("Probe timed out.")

        with patch("app.api.routes.get_ai_provider", return_value=mock_gemma):
            res = client.get("/api/provider/test")
            assert res.status_code == 504
            assert "timed out" in res.json()["detail"]
