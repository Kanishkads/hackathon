# LocalShield AI — Backend API & Stage 1 Gemma 4 Gateway

LocalShield AI is a Privacy-First AI Gateway designed for secure, leak-proof LLM interactions. It scans user prompts for sensitive entities (personal names, emails, phone numbers, API keys, passwords), substitutes them with deterministic placeholders (e.g., `[PERSON_1]`, `[EMAIL_1]`, `[PHONE_1]`), requires explicit server-side approval, forwards **only** the approved sanitized prompt to the configured AI provider, runs response leak validation before restoration, and safely restores permitted placeholders while keeping high-risk credentials redacted.

---

## 📁 Project Structure

```
backend/
├── .env.example                 # Environment variable templates (no real credentials)
├── .env                         # Local runtime configuration (git-ignored)
├── README.md
├── requirements.txt
├── scripts/
│   └── verify_gemma.py          # Real Gemma 4 model connectivity probe script
├── app/
│   ├── __init__.py
│   ├── main.py                  # FastAPI application entry point, CORS, routers
│   ├── core/
│   │   ├── __init__.py
│   │   ├── config.py            # Environment settings, Gemma 4 configs, cleaning of dummy keys
│   │   └── session.py           # In-memory ephemeral session manager & approval gate
│   ├── models/
│   │   ├── __init__.py
│   │   └── schemas.py           # Pydantic schemas (Scan, Health, Approve, Forward, Unmask, ProviderTest)
│   ├── api/
│   │   ├── __init__.py
│   │   └── routes.py            # /api/health, /api/scan, /api/approve, /api/forward, /api/unmask, /api/provider/test
│   ├── engine/
│   │   ├── __init__.py
│   │   ├── detector.py          # SensitiveEntityDetector with PERSON, EMAIL, PHONE, API_KEY, PASSWORD
│   │   ├── masker.py            # Masker engine generating typed placeholders with repetition support
│   │   └── unmasker.py          # ResponseUnmasker with response leak detection & high-risk redaction
│   └── services/
│       ├── __init__.py
│       └── ai_client.py         # AI providers: MockAIProvider, OpenAICompatibleProvider, GemmaAIProvider
└── tests/
    ├── __init__.py
    ├── conftest.py              # Autouse fixture enforcing offline mock mode for safe test execution
    ├── test_detector.py         # Tests for EMAIL, PHONE, API_KEY, PASSWORD, PERSON, and edge cases
    ├── test_masker.py           # Tests for placeholder generation, sequential numbering & repetition
    ├── test_api.py              # Tests for scan, approval gate & session isolation
    ├── test_forward.py          # Tests for POST /api/forward, timeouts, mock & error handling
    ├── test_gemma.py            # Tests for Gemma 4 provider, Google native REST & connectivity probe
    └── test_unmask.py           # Tests for POST /api/unmask, leak detection, high-risk redaction & isolation
```

---

## ⚙️ Environment Configuration

Copy the provided example file to create your local `backend/.env`:

```powershell
Copy-Item backend/.env.example backend/.env
```

Available environment variables:

| Variable | Description | Default |
| :--- | :--- | :--- |
| `AI_PROVIDER` | Active AI provider (`mock`, `gemma`, `openai`) | `mock` |
| `AI_MODEL` | Default model identifier | `gemma-4-26b-a4b-it` |
| `GEMMA_API_KEY` | API key for Google AI Studio / Gemini API | None |
| `GEMMA_MODEL` | Gemma 4 model identifier | `gemma-4-26b-a4b-it` |
| `GEMMA_API_URL` | Google Generative Language REST base URL | `https://generativelanguage.googleapis.com/v1beta` |
| `AI_TIMEOUT_SECONDS` | Request timeout threshold in seconds | `30.0` |
| `MAX_AI_RESPONSE_LENGTH` | Maximum characters accepted from AI provider | `100000` |
| `MAX_PROMPT_LENGTH` | Maximum user prompt input size | `50000` |
| `SESSION_TTL_SECONDS` | In-memory session lifespan in seconds | `900` (15 min) |

> 🔒 **Security Rule**: Never commit `.env` or real API credentials to version control. The application defaults safely to `AI_PROVIDER=mock` when no key is set.

---

## 🚀 Running the Backend (Windows PowerShell)

From the `backend` directory:

```powershell
# Run the FastAPI server
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

- **Base URL**: `http://127.0.0.1:8000`
- **Health Check**: `http://127.0.0.1:8000/api/health`
- **Model Connectivity Probe**: `http://127.0.0.1:8000/api/provider/test`
- **Interactive Swagger Docs**: `http://127.0.0.1:8000/docs`

---

## 🧪 Running Automated Tests

Run the full pytest suite from the `backend` directory using the project's virtual environment:

```powershell
.\.venv\Scripts\python.exe -m pytest tests -v
```

All 93 tests run offline and pass with zero network dependency.

---

## 📡 API Endpoints

### 1. `GET /api/health`
Checks gateway readiness.

### 2. `POST /api/scan`
Scans raw prompts for sensitive entities (`PERSON`, `EMAIL`, `PHONE`, `API_KEY`, `PASSWORD`), generates typed placeholders, and establishes an ephemeral server-side session.

### 3. `POST /api/approve`
Explicitly approves a session's sanitized prompt. Verifies that the prompt matches the server-side state.

### 4. `POST /api/forward`
Sends **only** the approved, sanitized prompt to the configured AI provider. Rejects unapproved, expired, or tampered sessions.

### 5. `POST /api/unmask`
Restores permitted placeholders in the AI response:
- Detects response leaks (if the model returns original secrets, `leak_detected` is set and restoration is blocked).
- Restores permitted entities (`PERSON`, `EMAIL`, `PHONE`).
- Keeps high-risk credentials (`PASSWORD`, `API_KEY`) redacted in `redacted_placeholders`.
- Leaves unknown/hallucinated placeholders unchanged and records warnings.

### 6. `GET /api/provider/test`
Probes provider connectivity by sending a minimal test request. Returns provider name, model ID, latency, and whether mock mode is active.
