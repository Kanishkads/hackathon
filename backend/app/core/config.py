"""LocalShield AI - Configuration Settings.

Holds global constants, input constraints, and session timeout values.
Never store secrets or credentials in this file.
"""

from typing import Final

# Gateway Metadata
SERVICE_NAME: Final[str] = "LocalShield AI Gateway"
VERSION: Final[str] = "0.2.0"

# Security & Input Constraints
# Maximum character count for prompt inputs to prevent memory exhaustion and DoS
MAX_PROMPT_LENGTH: Final[int] = 50_000

# Minimum non-whitespace characters required for a valid prompt
MIN_PROMPT_LENGTH: Final[int] = 1

# Session Lifetime
# Time-to-live for ephemeral in-memory placeholder mappings (15 minutes)
SESSION_TTL_SECONDS: Final[int] = 900

# Honest Privacy Boundary Disclaimer
PRIVACY_DISCLAIMER: Final[str] = (
    "LocalShield AI uses pattern-based heuristics and cannot guarantee 100% detection "
    "of all sensitive information. Always review the sanitized prompt preview before approval."
)
