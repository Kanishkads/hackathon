"""LocalShield AI - Configuration Settings.

Holds global constants, input constraints, session timeout values, and AI provider settings.
Values are loaded from environment variables with safe defaults.
Never hard-code secrets or credentials in this file.
"""

import os
from typing import Final, Optional
from dotenv import load_dotenv

# Load optional .env file if present
load_dotenv()

# Gateway Metadata
SERVICE_NAME: Final[str] = "LocalShield AI Gateway"
VERSION: Final[str] = "0.3.0"

# Security & Input Constraints
# Maximum character count for prompt inputs to prevent memory exhaustion and DoS
MAX_PROMPT_LENGTH: Final[int] = int(os.getenv("MAX_PROMPT_LENGTH", "50000"))

# Minimum non-whitespace characters required for a valid prompt
MIN_PROMPT_LENGTH: Final[int] = 1

# Session Lifetime
# Time-to-live for ephemeral in-memory placeholder mappings (15 minutes by default)
SESSION_TTL_SECONDS: Final[int] = int(os.getenv("SESSION_TTL_SECONDS", "900"))

# Honest Privacy Boundary Disclaimer
PRIVACY_DISCLAIMER: Final[str] = (
    "LocalShield AI uses pattern-based heuristics and cannot guarantee 100% detection "
    "of all sensitive information. Always review the sanitized prompt preview before approval."
)

# AI Provider Configuration
# Supported providers: 'mock', 'openai', 'ollama'
AI_PROVIDER: Final[str] = os.getenv("AI_PROVIDER", "mock").strip().lower()
AI_MODEL: Final[str] = os.getenv("AI_MODEL", "mock-llama-3").strip()
AI_API_KEY: Final[Optional[str]] = os.getenv("AI_API_KEY", "").strip() or None
AI_API_URL: Final[str] = os.getenv("AI_API_URL", "https://api.openai.com/v1").strip()
AI_TIMEOUT_SECONDS: Final[float] = float(os.getenv("AI_TIMEOUT_SECONDS", "30.0"))
MAX_AI_RESPONSE_LENGTH: Final[int] = int(os.getenv("MAX_AI_RESPONSE_LENGTH", "100000"))
