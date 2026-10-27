"""LocalShield AI - AI Provider Client Services.

Provides a modular interface for external AI services.
Guarantees that ONLY the approved sanitized prompt is transmitted to providers.
Never transmits original prompts, session mappings, or sensitive values.
Includes a deterministic offline MockAIProvider for local testing without network calls.
"""

from abc import ABC, abstractmethod
import re
from typing import Any, Optional
import httpx

from app.core import config

_SENTINEL = object()


class AIProviderError(Exception):
    """Base exception for AI provider operations."""
    pass


class AIProviderConfigError(AIProviderError):
    """Raised when an AI provider lacks required configuration or credentials."""
    pass


class AIProviderTimeoutError(AIProviderError):
    """Raised when an AI provider request exceeds the timeout threshold."""
    pass


class BaseAIProvider(ABC):
    """Abstract base class for all AI provider adapters."""

    @abstractmethod
    async def generate(self, sanitized_prompt: str) -> str:
        """Sends the approved sanitized prompt to the provider and returns the raw response.

        Args:
            sanitized_prompt: The prompt with all sensitive entities replaced by placeholders.

        Returns:
            The raw text response from the AI provider (placeholders preserved).
        """
        pass

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """The identifier of the provider (e.g., 'mock', 'openai')."""
        pass

    @property
    @abstractmethod
    def model_name(self) -> str:
        """The model utilized by this provider instance."""
        pass

    @property
    @abstractmethod
    def is_mock(self) -> bool:
        """True if the provider is a local mock without external network calls."""
        pass

    @abstractmethod
    async def test_connectivity(self) -> dict:
        """Sends a minimal model probe to verify real model connectivity and latency."""
        pass


class MockAIProvider(BaseAIProvider):
    """Deterministic offline mock provider for local testing and hackathon demonstrations.

    Never makes external network calls. Intentionally preserves all placeholder tokens.
    """

    def __init__(self, model_name: Optional[str] = None):
        self._model_name = model_name or config.AI_MODEL

    @property
    def provider_name(self) -> str:
        return "mock"

    @property
    def model_name(self) -> str:
        return self._model_name

    @property
    def is_mock(self) -> bool:
        return True

    async def test_connectivity(self) -> dict:
        """Offline connectivity probe verification."""
        return {
            "status": "connected",
            "connected": True,
            "provider": self.provider_name,
            "model": self.model_name,
            "is_mock": True,
            "latency_ms": 1,
            "sample_response": "[LocalShield Mock AI]: offline model probe verified.",
        }

    async def generate(self, sanitized_prompt: str) -> str:
        """Returns a deterministic response acknowledging the sanitized prompt and any placeholders."""
        # Detect placeholders present in the sanitized prompt
        placeholders = re.findall(r'\[[A-Z_]+_\d+\]', sanitized_prompt)
        unique_placeholders = sorted(list(set(placeholders)))

        if unique_placeholders:
            ph_summary = ", ".join(unique_placeholders)
            return (
                f"[LocalShield Mock AI Response]: I have processed your request safely. "
                f"Referenced sanitized entities: {ph_summary}. "
                f"Your request has been handled without exposing raw sensitive data. "
                f"(Generated offline by LocalShield Mock Provider, Model: {self.model_name})"
            )

        snippet = sanitized_prompt.strip()[:80]
        return (
            f"[LocalShield Mock AI Response]: I received and processed your inquiry: "
            f"'{snippet}...'. All instructions have been acknowledged. "
            f"(Generated offline by LocalShield Mock Provider, Model: {self.model_name})"
        )

    def __repr__(self) -> str:
        return f"MockAIProvider(model={self.model_name})"


class OpenAICompatibleProvider(BaseAIProvider):
    """Adapter for OpenAI and OpenAI-compatible API providers (e.g. Ollama, vLLM, Azure)."""

    def __init__(
        self,
        api_key: Any = _SENTINEL,
        api_url: Optional[str] = None,
        model_name: Optional[str] = None,
        timeout_seconds: Optional[float] = None,
        max_response_length: Optional[int] = None,
    ):
        raw_key = config.AI_API_KEY if api_key is _SENTINEL else api_key
        if raw_key and any(p in str(raw_key).lower() for p in ("your_", "placeholder")):
            raw_key = None
        self._api_key = raw_key
        self._api_url = (api_url or config.AI_API_URL).rstrip("/")
        self._model_name = model_name or config.AI_MODEL
        self._timeout_seconds = (
            timeout_seconds if timeout_seconds is not None else config.AI_TIMEOUT_SECONDS
        )
        self._max_response_length = (
            max_response_length if max_response_length is not None else config.MAX_AI_RESPONSE_LENGTH
        )

        # Enforce credentials if contacting cloud endpoint
        is_local = "localhost" in self._api_url.lower() or "127.0.0.1" in self._api_url.lower()
        if not is_local and not self._api_key:
            raise AIProviderConfigError(
                "OpenAI provider selected, but no API key is configured. "
                "Set AI_API_KEY in your environment or use AI_PROVIDER=mock for local testing."
            )


    @property
    def provider_name(self) -> str:
        return "openai"

    @property
    def model_name(self) -> str:
        return self._model_name

    @property
    def is_mock(self) -> bool:
        return False

    async def generate(self, sanitized_prompt: str) -> str:
        """Forwards the approved sanitized prompt to the /chat/completions endpoint."""
        endpoint = f"{self._api_url}/chat/completions"
        headers = {
            "Content-Type": "application/json",
        }
        if self._api_key:
            headers["Authorization"] = f"Bearer {self._api_key}"

        payload = {
            "model": self.model_name,
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "You are a helpful assistant. Keep any placeholders formatted like "
                        "[EMAIL_1], [PHONE_1], [API_KEY_1] intact in your responses."
                    ),
                },
                {"role": "user", "content": sanitized_prompt},
            ],
            "temperature": 0.3,
        }

        try:
            async with httpx.AsyncClient(timeout=self._timeout_seconds) as client:
                response = await client.post(endpoint, json=payload, headers=headers)

                if response.status_code != 200:
                    # Sanitize error message - never return headers or credentials
                    raise AIProviderError(
                        f"Upstream AI provider returned status code {response.status_code}."
                    )

                data = response.json()
                choices = data.get("choices", [])
                if not choices:
                    raise AIProviderError("Upstream AI provider returned an empty response choices list.")

                content = choices[0].get("message", {}).get("content", "")
                if not content:
                    raise AIProviderError("Upstream AI provider returned empty message content.")

                # Enforce response length boundary
                if len(content) > self._max_response_length:
                    raise AIProviderError(
                        f"AI response exceeded maximum allowed length of {self._max_response_length} characters."
                    )

                return content

        except httpx.TimeoutException as exc:
            # Raise dedicated timeout error
            raise AIProviderTimeoutError("AI provider request timed out.") from exc
        except httpx.RequestError as exc:
            # Generic network error without leaking URLs or headers
            raise AIProviderError("Failed to connect to AI provider network endpoint.") from exc

    async def test_connectivity(self) -> dict:
        """Sends a minimal probe request to verify model connectivity and measures latency."""
        import time
        start_time = time.perf_counter()
        probe_prompt = "Say 'Model probe acknowledged' in one short sentence."
        sample = await self.generate(probe_prompt)
        latency_ms = round((time.perf_counter() - start_time) * 1000)

        return {
            "status": "connected",
            "connected": True,
            "provider": self.provider_name,
            "model": self.model_name,
            "is_mock": False,
            "latency_ms": latency_ms,
            "sample_response": sample.strip()[:160],
        }

    def __repr__(self) -> str:
        """Safe representation that redacts API keys."""
        masked_key = "***" if self._api_key else "None"
        return f"OpenAICompatibleProvider(model={self.model_name}, url={self._api_url}, key={masked_key})"


class GemmaAIProvider(BaseAIProvider):
    """Real Gemma 4 AI Provider Adapter.

    Integrates Google DeepMind's Gemma 4 open-weights model family.
    Supports:
    1. Google AI Studio / Gemini API native REST endpoint:
       https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
    2. OpenAI-compatible endpoints (OpenRouter, local Ollama, Groq, LiteRT-LM, etc.):
       {api_url}/chat/completions

    Security & Safety Guarantees:
    - ONLY user-approved, sanitized prompts are sent upstream.
    - Placeholder tokens ([EMAIL_1], [PHONE_1], etc.) are strictly preserved.
    - Credentials are kept exclusively in backend .env, never leaked in responses or logs.
    - Safe error handling: raises HTTP 502/503/504 errors on failure without leaking tokens.
    - Strictly differentiates MOCK mode from LIVE mode; never returns fake text when LIVE fails.
    - Performs real model connectivity verification via test_connectivity().
    """

    def __init__(
        self,
        api_key: Any = _SENTINEL,
        api_url: Optional[str] = None,
        model_name: Optional[str] = None,
        timeout_seconds: Optional[float] = None,
        max_response_length: Optional[int] = None,
    ):
        raw_key = config.GEMMA_API_KEY if api_key is _SENTINEL else api_key
        if raw_key and any(p in str(raw_key).lower() for p in ("your_", "placeholder")):
            raw_key = None
        self._api_key = raw_key
        self._api_url = (api_url or config.GEMMA_API_URL).rstrip("/")
        raw_model = (model_name or config.GEMMA_MODEL).strip()
        if raw_model in {"mock-llama-3", ""}:
            raw_model = "gemma-4-26b-a4b-it"
        self._model_name = raw_model
        self._timeout_seconds = (
            timeout_seconds if timeout_seconds is not None else config.AI_TIMEOUT_SECONDS
        )
        self._max_response_length = (
            max_response_length if max_response_length is not None else config.MAX_AI_RESPONSE_LENGTH
        )

        # 1. Validate Model Identifier
        self._validate_model_id(self._model_name)

        # 2. Enforce Credentials for Cloud Providers (Google AI Studio, OpenRouter, etc.)
        is_local = "localhost" in self._api_url.lower() or "127.0.0.1" in self._api_url.lower()
        if not is_local and not self._api_key:
            raise AIProviderConfigError(
                f"Gemma 4 provider requires an API key for remote endpoint '{self._api_url}'. "
                "Set GEMMA_API_KEY or AI_API_KEY in your backend/.env file."
            )

    @classmethod
    def _validate_model_id(cls, model_name: str) -> None:
        """Validates that the configured model belongs to the supported Gemma 4 family."""
        normalized = model_name.strip().lower()
        is_valid = (
            normalized in config.SUPPORTED_GEMMA_MODELS
            or "gemma-4" in normalized
            or "gemma4" in normalized
        )
        if not is_valid:
            supported = ", ".join(config.SUPPORTED_GEMMA_MODELS[:4])
            raise AIProviderConfigError(
                f"Unsupported model identifier: '{model_name}'. "
                f"Gemma 4 provider requires a verified Gemma 4 model (e.g. {supported})."
            )

    @property
    def provider_name(self) -> str:
        return "gemma"

    @property
    def model_name(self) -> str:
        return self._model_name

    @property
    def is_mock(self) -> bool:
        return False

    @property
    def is_google_native(self) -> bool:
        """True if targeting Google Generative Language native API."""
        return "googleapis.com" in self._api_url.lower()

    async def generate(self, sanitized_prompt: str) -> str:
        """Forwards the approved sanitized prompt to the configured Gemma 4 provider."""
        if self.is_google_native:
            return await self._generate_google_native(sanitized_prompt)
        return await self._generate_openai_compatible(sanitized_prompt)

    async def _generate_google_native(self, sanitized_prompt: str) -> str:
        """Calls Google AI Studio native generateContent REST endpoint."""
        clean_model = self._model_name
        if clean_model.startswith("models/"):
            clean_model = clean_model[len("models/"):]
        elif "google/" in clean_model:
            clean_model = clean_model.split("google/")[-1]

        endpoint = f"{self._api_url}/models/{clean_model}:generateContent"
        headers = {
            "Content-Type": "application/json",
            "x-goog-api-key": self._api_key or "",
        }
        payload = {
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": sanitized_prompt}]
                }
            ],
            "systemInstruction": {
                "parts": [{
                    "text": (
                        "You are a helpful assistant powered by Gemma 4. "
                        "Keep any placeholders formatted like [EMAIL_1], [PHONE_1], "
                        "[API_KEY_1], [PASSWORD_1] intact in your responses."
                    )
                }]
            },
            "generationConfig": {
                "temperature": 0.3,
            }
        }

        try:
            async with httpx.AsyncClient(timeout=self._timeout_seconds) as client:
                response = await client.post(endpoint, json=payload, headers=headers)
                if response.status_code != 200:
                    try:
                        err_json = response.json()
                        err_msg = err_json.get("error", {}).get("message", "")
                    except Exception:
                        err_msg = ""
                    detail = f": {err_msg}" if err_msg else ""
                    raise AIProviderError(
                        f"Gemma 4 upstream provider returned HTTP {response.status_code}{detail}."
                    )

                data = response.json()
                candidates = data.get("candidates", [])
                if not candidates:
                    raise AIProviderError("Gemma 4 provider returned an empty candidates list.")

                content_obj = candidates[0].get("content", {})
                parts = content_obj.get("parts", [])
                if not parts:
                    raise AIProviderError("Gemma 4 provider returned candidate without content parts.")

                text = parts[0].get("text", "")
                if not text:
                    raise AIProviderError("Gemma 4 provider returned empty text.")

                if len(text) > self._max_response_length:
                    raise AIProviderError(
                        f"AI response exceeded maximum allowed length of {self._max_response_length} characters."
                    )

                return text

        except httpx.TimeoutException as exc:
            raise AIProviderTimeoutError("Gemma 4 provider request timed out.") from exc
        except httpx.RequestError as exc:
            raise AIProviderError("Failed to connect to Gemma 4 provider network endpoint.") from exc

    async def _generate_openai_compatible(self, sanitized_prompt: str) -> str:
        """Calls OpenAI-compatible /chat/completions endpoint (OpenRouter, Ollama, etc.)."""
        endpoint = f"{self._api_url}/chat/completions"
        headers = {"Content-Type": "application/json"}
        if self._api_key:
            headers["Authorization"] = f"Bearer {self._api_key}"

        payload = {
            "model": self._model_name,
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "You are a helpful assistant powered by Gemma 4. "
                        "Keep any placeholders formatted like [EMAIL_1], [PHONE_1], "
                        "[API_KEY_1], [PASSWORD_1] intact in your responses."
                    ),
                },
                {"role": "user", "content": sanitized_prompt},
            ],
            "temperature": 0.3,
        }

        try:
            async with httpx.AsyncClient(timeout=self._timeout_seconds) as client:
                response = await client.post(endpoint, json=payload, headers=headers)
                if response.status_code != 200:
                    try:
                        err_json = response.json()
                        err_msg = err_json.get("error", {}).get("message", "")
                    except Exception:
                        err_msg = ""
                    detail = f": {err_msg}" if err_msg else ""
                    raise AIProviderError(
                        f"Gemma 4 upstream provider returned HTTP {response.status_code}{detail}."
                    )

                data = response.json()
                choices = data.get("choices", [])
                if not choices:
                    raise AIProviderError("Gemma 4 provider returned an empty choices list.")

                content = choices[0].get("message", {}).get("content", "")
                if not content:
                    raise AIProviderError("Gemma 4 provider returned empty message content.")

                if len(content) > self._max_response_length:
                    raise AIProviderError(
                        f"AI response exceeded maximum allowed length of {self._max_response_length} characters."
                    )

                return content

        except httpx.TimeoutException as exc:
            raise AIProviderTimeoutError("Gemma 4 provider request timed out.") from exc
        except httpx.RequestError as exc:
            raise AIProviderError("Failed to connect to Gemma 4 provider network endpoint.") from exc

    async def test_connectivity(self) -> dict:
        """Sends a minimal probe request to verify real Gemma 4 model connectivity."""
        import time
        start_time = time.perf_counter()
        probe_prompt = "Say 'Gemma 4 connected' in one short sentence."
        sample = await self.generate(probe_prompt)
        latency_ms = round((time.perf_counter() - start_time) * 1000)

        return {
            "status": "connected",
            "connected": True,
            "provider": self.provider_name,
            "model": self.model_name,
            "is_mock": False,
            "latency_ms": latency_ms,
            "sample_response": sample.strip()[:160],
        }

    def __repr__(self) -> str:
        masked_key = "***" if self._api_key else "None"
        return f"GemmaAIProvider(model={self.model_name}, url={self._api_url}, key={masked_key})"


def get_ai_provider(provider_type: Optional[str] = None) -> BaseAIProvider:
    """Factory function to instantiate the configured AI provider.

    Args:
        provider_type: Optional override ('mock', 'gemma', 'google', 'openrouter', 'openai', 'ollama').
                       If None, defaults to config.AI_PROVIDER.

    Returns:
        An instance of BaseAIProvider.

    Raises:
        AIProviderConfigError: If an invalid provider or missing credentials are encountered.
    """
    provider = (provider_type or config.AI_PROVIDER).strip().lower()

    if provider == "mock":
        return MockAIProvider()

    if provider in {"gemma", "google", "openrouter", "gemma4"}:
        return GemmaAIProvider()

    if provider in {"openai", "ollama"}:
        return OpenAICompatibleProvider()

    raise AIProviderConfigError(
        f"Unsupported AI provider: '{provider}'. Supported options: 'mock', 'gemma', 'google', 'openrouter', 'openai', 'ollama'."
    )

