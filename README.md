# LocalShield AI — Privacy-First AI Gateway (Stage 1: Secure Gemma 4 Integration & Safe Restoration)

LocalShield AI is a Privacy-First AI Gateway designed for secure, leak-proof LLM interactions. It scans user prompts for sensitive entities (personal names, emails, phone numbers, API keys, passwords), substitutes them with deterministic, typed placeholders (e.g., `[PERSON_1]`, `[EMAIL_1]`, `[PHONE_1]`), requires explicit server-side approval before forwarding, dispatches **only** the approved sanitized prompt to the configured AI provider (Google Gemma 4 or offline mock), runs pre-restoration leak validation on model responses, and safely restores permitted placeholders while keeping high-risk credentials redacted.

---

## 🚀 Quick Start (Windows PowerShell)

### 1. Backend (FastAPI + Gemma 4 Gateway)

```powershell
# Navigate to backend directory
cd backend

# Install dependencies (if not already installed)
.\.venv\Scripts\pip.exe install -r requirements.txt

# Start FastAPI server on port 8000
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

- **Health Check**: `http://127.0.0.1:8000/api/health`
- **Model Connectivity Probe**: `http://127.0.0.1:8000/api/provider/test`
- **Interactive Swagger Documentation**: `http://127.0.0.1:8000/docs`

### 2. Frontend (React + Vite + TypeScript)

```powershell
# Navigate to frontend directory
cd frontend

# Start Vite dev server
npm run dev
```

- **App Console**: `http://localhost:5173`

---

## 🤖 Stage 1: Verified Gemma 4 Model Integration

- **Model Identifier**: `gemma-4-26b-a4b-it` (also supports `gemma-4-31b-it`)
- **Model Family**: Google DeepMind Gemma 4 open weights
- **License**: Apache 2.0 (Commercially permissive)
- **Official Documentation**: [https://ai.google.dev/gemma](https://ai.google.dev/gemma)
- **Supported Endpoints**:
  1. **Google AI Studio Native REST**: `https://generativelanguage.googleapis.com/v1beta/models/gemma-4-26b-a4b-it:generateContent` with `x-goog-api-key` header.
  2. **OpenAI-Compatible Aggregators**: OpenRouter (`google/gemma-4-26b-a4b-it`), vLLM, or local proxy (`http://localhost:11434/v1`).
  3. **Localhost Runtimes**: Ollama / LM Studio on `localhost` without requiring cloud API keys.
  4. **Offline Mock Mode**: Deterministic simulation with zero network calls and zero credentials required.

### Difference Between MOCK Mode and LIVE Gemma Mode

| Feature | MOCK Mode (`AI_PROVIDER=mock`) | LIVE Mode (`AI_PROVIDER=gemma`) |
| :--- | :--- | :--- |
| **Network Call** | None (100% offline) | Dispatches HTTP POST to Google AI Studio / provider endpoint |
| **Credentials** | Not required | Enforces valid `GEMMA_API_KEY` (or `AI_API_KEY`) |
| **Response Text** | Deterministic simulation acknowledging preserved placeholders | Real generative response from the Gemma 4 neural model |
| **Failure Behavior** | Never fails due to network/creds | Fails cleanly with HTTP 503 (missing key) or 502/504; **never** falls back to fake responses |
| **Testing Safe** | Safe for CI/CD and offline verification | Requires active internet and valid API key |

### Local Provider Configuration (`backend/.env`)

```ini
# Gateway Provider Mode: 'mock' (default) or 'gemma'
AI_PROVIDER=mock

# Live Gemma 4 Settings (only required when AI_PROVIDER=gemma)
GEMMA_API_KEY=your_google_ai_studio_api_key_here
GEMMA_MODEL=gemma-4-26b-a4b-it
GEMMA_API_URL=https://generativelanguage.googleapis.com/v1beta
```

---

## 🛡️ Placeholder Detection & Restoration Policies

### 1. Supported Sensitive Entity Types
- **`PERSON`**: Confidently identified personal names via honorific titles (e.g., *Dr. Jane Doe*, *Mr. John Smith*, *Prof. Alan Turing*) and contextual declarations (*My name is Alice Walker*). Filtered against common false-positive words (e.g., *LocalShield AI*, days of the week). Placeholder: `[PERSON_1]`.
- **`EMAIL`**: RFC 5322 compliant email addresses. Placeholder: `[EMAIL_1]`.
- **`PHONE`**: Formatted international and domestic phone numbers. Placeholder: `[PHONE_1]`.
- **`API_KEY`**: Vendor tokens (OpenAI `sk-proj-`, AWS `AKIA`, GitHub `ghp_`, Bearer tokens, generic assignments). Placeholder: `[API_KEY_1]`.
- **`PASSWORD`**: Password assignments (`password = "..."`, `db_pass: "..."`). Placeholder: `[PASSWORD_1]`.

### 2. Pre-Restoration Security Checks
- **Response Leak Detection**: Before restoration, the model's raw response is scanned against the current session's original secret values. If the model echoed an unmasked sensitive value, `leak_detected` is flagged, restoration is aborted, and a security alert is issued.
- **Approval Gate**: Requests to unmask or forward must reference an approved, unexpired session ID whose approved prompt matches the session state.

### 3. Restoration Policy (Fail-Safe & Selective)
- **Permitted Personal Information**: `PERSON`, `EMAIL`, and `PHONE` placeholders are restored only when they exist in the current session mapping and actually appear in the model response. If the model did not output a placeholder, the original value is never injected.
- **High-Risk Credential Redaction**: `PASSWORD` and `API_KEY` placeholders are **never** restored into user-visible responses. They remain safely redacted in `[PASSWORD_1]` / `[API_KEY_1]` format and are tracked in `redacted_placeholders`.
- **Hallucinated / Malformed Tokens**: Unknown tokens (e.g. `[EMAIL_99]`) or malformed brackets (e.g. `[EMAIL_]`) are never substituted and are flagged as warnings.

---

## 🧪 Test Suites & Verification

### Run Backend Tests (93 Tests, 100% Passing)

From the `backend` directory:

```powershell
.\.venv\Scripts\python.exe -m pytest tests -v
```

### Run Real Gemma 4 Model Verification Script

From the `backend` directory:

```powershell
.\.venv\Scripts\python.exe scripts/verify_gemma.py
```

### Run Frontend Lint & Build

From the `frontend` directory:

```powershell
npm run lint
npm run build
```

---

## ⚠️ Known Limitations & Detection Boundaries

1. **Heuristic Name Detection**: Personal names are detected using high-confidence honorifics and contextual phrasing. Arbitrary single-word names or names without context are intentionally not captured to prevent high false-positive rates on common vocabulary.
2. **Ephemeral In-Memory Sessions**: Sessions have a configurable TTL (`SESSION_TTL_SECONDS=900`). Once expired or cleared, placeholders can never be restored.
3. **Live Gemma 4 Requires Credentials**: When `AI_PROVIDER=gemma`, a valid Google AI Studio key is required. Without a key, live mode fails cleanly with HTTP 503 rather than fabricating responses.