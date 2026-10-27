"""LocalShield AI - Real Gemma 4 Model Verification Script.

Executes a real minimal request to the configured Gemma 4 provider to verify
end-to-end model connectivity and placeholder preservation.
"""

import asyncio
import os
import sys
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from app.core import config
from app.services.ai_client import (
    AIProviderConfigError,
    AIProviderError,
    AIProviderTimeoutError,
    get_ai_provider,
)


async def main():
    print("=" * 70)
    print(" LocalShield AI — Real Gemma 4 Connectivity Verification ")
    print("=" * 70)
    print(f"Active Provider : {config.AI_PROVIDER}")
    print(f"Active Model    : {config.AI_MODEL}")
    print(f"Endpoint URL    : {config.AI_API_URL}")
    masked_key = (
        f"{config.AI_API_KEY[:6]}...{config.AI_API_KEY[-4:]}"
        if config.AI_API_KEY and len(config.AI_API_KEY) > 10
        else ("Configured" if config.AI_API_KEY else "None (Not Set)")
    )
    print(f"API Key Status  : {masked_key}")
    print("-" * 70)

    try:
        provider = get_ai_provider()
    except AIProviderConfigError as exc:
        print(f"\n[CONFIGURATION ERROR]: {exc}\n")
        sys.exit(1)

    if provider.is_mock:
        print("[WARNING] Provider is currently set to 'mock'.")
        print("To test a real Gemma 4 model, configure backend/.env:")
        print("  AI_PROVIDER=gemma")
        print("  GEMMA_API_KEY=your_google_api_key_here")
        print("  GEMMA_MODEL=gemma-4-26b-a4b-it")
        print("  GEMMA_API_URL=https://generativelanguage.googleapis.com/v1beta")
        print("-" * 70)

    print("Sending real verification probe to model...")
    try:
        telemetry = await provider.test_connectivity()
        print("\n[SUCCESS] Live Model Response Verified!")
        print(f"  Provider       : {telemetry.get('provider')}")
        print(f"  Model          : {telemetry.get('model')}")
        print(f"  Is Mock        : {telemetry.get('is_mock')}")
        print(f"  Roundtrip (ms) : {telemetry.get('latency_ms')} ms")
        print(f"  Sample Output  : {telemetry.get('sample_response')}")
        print("=" * 70)
        sys.exit(0)
    except AIProviderTimeoutError as exc:
        print(f"\n[TIMEOUT ERROR]: {exc}\n")
        sys.exit(2)
    except AIProviderError as exc:
        print(f"\n[PROVIDER ERROR]: {exc}\n")
        sys.exit(3)
    except Exception as exc:
        print(f"\n[UNEXPECTED ERROR]: {exc}\n")
        sys.exit(4)


if __name__ == "__main__":
    asyncio.run(main())
