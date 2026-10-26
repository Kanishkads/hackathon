"""LocalShield AI - AI Provider Client Services.

Provides a modular interface for external AI services.
Guarantees that ONLY the approved sanitized prompt is transmitted to providers.
Never transmits original prompts, session mappings, or sensitive values.
Includes a deterministic offline MockAIProvider for local testing without network calls.
"""

from abc import ABC, abstractmethod
import re
from typing import Optional
import httpx

from app.core import config


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
        api_key: Optional[str] = None,
        api_url: Optional[str] = None,
        model_name: Optional[str] = None,
        timeout_seconds: Optional[float] = None,
        max_response_length: Optional[int] = None,
    ):
        self._api_key = api_key if api_key is not None else config.AI_API_KEY
        self._api_url = (api_url or config.AI_API_URL).rstrip("/")
        self._model_name = model_name or config.AI_MODEL
        self._timeout_seconds = (
            timeout_seconds if timeout_seconds is not None else config.AI_TIMEOUT_SECONDS
        )
        self._max_response_length = (
            max_response_length if max_response_length is not None else config.MAX_AI_RESPONSE_LENGTH
        )

        # Enforce credentials if contacting OpenAI cloud endpoint
        is_openai_cloud = "openai.com" in self._api_url.lower()
        if is_openai_cloud and not self._api_key:
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

    def __repr__(self) -> str:
        """Safe representation that redacts API keys."""
        masked_key = "***" if self._api_key else "None"
        return f"OpenAICompatibleProvider(model={self.model_name}, url={self._api_url}, key={masked_key})"


def get_ai_provider(provider_type: Optional[str] = None) -> BaseAIProvider:
    """Factory function to instantiate the configured AI provider.

    Args:
        provider_type: Optional override ('mock', 'openai', 'ollama').
                       If None, defaults to config.AI_PROVIDER.

    Returns:
        An instance of BaseAIProvider.

    Raises:
        AIProviderConfigError: If an invalid provider or missing credentials are encountered.
    """
    provider = (provider_type or config.AI_PROVIDER).strip().lower()

    if provider == "mock":
        return MockAIProvider()

    if provider in {"openai", "ollama"}:
        return OpenAICompatibleProvider()

    raise AIProviderConfigError(
        f"Unsupported AI provider: '{provider}'. Supported options: 'mock', 'openai', 'ollama'."
    )
