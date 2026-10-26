# LocalShield AI — Backend API & Secure AI Gateway (Phase 3A)

LocalShield AI is a Privacy-First AI Gateway designed for secure, leak-proof LLM interactions. It scans user prompts for sensitive entities (emails, phone numbers, API keys, passwords), substitutes them with deterministic placeholders (e.g., `[EMAIL_1]`, `[PHONE_1]`), requires explicit server-side approval, and safely forwards **only** the approved sanitized prompt to the configured AI provider.

---

## 📁 Project Structure

```
backend/
├── .env.example                 # Environment variable templates (no real credentials)
├── README.md
├── requirements.txt
├── app/
│   ├── __init__.py
│   ├── main.py                  # FastAPI application entry point, CORS, routers
│   ├── core/
│   │   ├── __init__.py
│   │   ├── config.py            # Environment-driven settings, limits, timeouts, metadata
│   │   └── session.py           # In-memory ephemeral session manager & approval gate
│   ├── models/
│   │   ├── __init__.py
│   │   └── schemas.py           # Pydantic schemas (Scan, Health, Approve, Forward)
│   ├── api/
│   │   ├── __init__.py
│   │   └── routes.py            # /api/health, /api/scan, /api/approve, /api/session, /api/forward
│   ├── engine/
│   │   ├── __init__.py
│   │   ├── detector.py          # Regex & heuristic entity detector (Phase 1)
│   │   └── masker.py            # Placeholder mapping & sanitization engine (Phase 1)
│   └── services/
│       ├── __init__.py
│       └── ai_client.py         # Modular AI provider interface (Mock & OpenAI-compatible)
└── tests/
    ├── __init__.py
    ├── test_detector.py         # 14 tests for entity detection rules
    ├── test_masker.py           # 8 tests for placeholder generation & consistency
    ├── test_api.py              # 19 tests for scan, approval gate & session isolation
    └── test_forward.py          # 12 tests for POST /api/forward, timeouts, mock & error handling
```

---

## ⚙️ Environment Configuration

Copy the provided example file to create your local `.env`:

```powershell
cp backend/.env.example backend/.env
```

Available environment variables:

| Variable | Description | Default |
| :--- | :--- | :--- |
| `AI_PROVIDER` | Active AI provider (`mock`, `openai`, `ollama`) | `mock` |
| `AI_MODEL` | Model identifier used for completions | `mock-llama-3` |
| `AI_API_KEY` | API key for external providers (omit or leave empty for `mock`) | None |
| `AI_API_URL` | Base endpoint URL for completions | `https://api.openai.com/v1` |
| `AI_TIMEOUT_SECONDS` | Request timeout threshold in seconds | `30.0` |
| `MAX_AI_RESPONSE_LENGTH` | Maximum characters accepted from AI provider | `100000` |
| `MAX_PROMPT_LENGTH` | Maximum user prompt input size | `50000` |
| `SESSION_TTL_SECONDS` | In-memory session lifespan in seconds | `900` (15 min) |

> 🔒 **Security Rule**: Never commit `.env` or real API credentials to version control. The application defaults safely to `AI_PROVIDER=mock` when no key is set.

---

## 🚀 Getting Started (Windows PowerShell)

All commands below should be executed from the project root (`c:\Users\BARANEEDHARAN\Desktop\localshield`):

### 1. Activate the Virtual Environment

```powershell
.\backend\.venv\Scripts\Activate.ps1
```

### 2. Install Dependencies

```powershell
pip install -r backend/requirements.txt
```

### 3. Start the FastAPI Server

```powershell
python -m uvicorn app.main:app --reload --app-dir backend --host 127.0.0.1 --port 8000
```

- **Base URL**: `http://127.0.0.1:8000`
- **Health Check**: `http://127.0.0.1:8000/api/health`
- **Interactive Swagger Docs**: `http://127.0.0.1:8000/docs`

---

## 📡 API Endpoint Contracts

### 1. `GET /api/health`
Checks gateway readiness.
- **Response `200 OK`**:
  ```json
  {
    "status": "ok",
    "service": "LocalShield AI Gateway",
    "version": "0.3.0"
  }
  ```

---

### 2. `POST /api/scan`
Scans raw prompts for sensitive entities, generates placeholders, and creates an ephemeral session.
- **Request Body**:
  ```json
  {
    "prompt": "Please email alice@example.com and call +1-555-0199."
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "session_id": "Xk9Z2_m...",
    "sanitized_prompt": "Please email [EMAIL_1] and call [PHONE_1].",
    "entity_types": ["EMAIL", "PHONE"],
    "placeholders": ["[EMAIL_1]", "[PHONE_1]"],
    "entities_detected": [
      {"entity_type": "EMAIL", "placeholder": "[EMAIL_1]", "confidence": "HIGH"},
      {"entity_type": "PHONE", "placeholder": "[PHONE_1]", "confidence": "HIGH"}
    ],
    "warnings": [],
    "disclaimer": "LocalShield AI uses pattern-based heuristics and cannot guarantee 100% detection of all sensitive information. Always review the sanitized prompt preview before approval."
  }
  ```

---

### 3. `POST /api/approve`
Human-in-the-loop approval gate. Verifies the user approved the exact sanitized prompt via SHA-256 integrity check.
- **Request Body**:
  ```json
  {
    "session_id": "Xk9Z2_m...",
    "sanitized_prompt": "Please email [EMAIL_1] and call [PHONE_1]."
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "session_id": "Xk9Z2_m...",
    "approved": true,
    "message": "Session approved successfully.",
    "sanitized_prompt_hash": "a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e"
  }
  ```
- **Error Codes**: `400 Bad Request` (prompt tampered or modified), `404 Not Found` (session missing or expired).

---

### 4. `POST /api/forward` *(New in Phase 3A)*
Forwards the approved sanitized prompt to the configured AI provider.
- **Request Body**:
  ```json
  {
    "session_id": "Xk9Z2_m...",
    "sanitized_prompt": "Please email [EMAIL_1] and call [PHONE_1]."
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "session_id": "Xk9Z2_m...",
    "provider": "mock",
    "model": "mock-llama-3",
    "sanitized_response": "[LocalShield Mock AI Response]: I have processed your request safely. Referenced sanitized entities: [EMAIL_1], [PHONE_1]. Your request has been handled without exposing raw sensitive data. (Generated offline by LocalShield Mock Provider, Model: mock-llama-3)",
    "is_mock": true,
    "disclaimer": "LocalShield AI uses pattern-based heuristics and cannot guarantee 100% detection of all sensitive information. Always review the sanitized prompt preview before approval."
  }
  ```
- **Error Codes**:
  - `400 Bad Request`: Submitted prompt does not match the approved session hash.
  - `403 Forbidden`: Session has not been approved via `/api/approve`.
  - `404 Not Found`: Session does not exist or has expired.
  - `502 Bad Gateway`: AI provider connection error or upstream failure.
  - `503 Service Unavailable`: AI provider is requested but missing required API credentials.
  - `504 Gateway Timeout`: AI provider exceeded request timeout threshold.

---

## 🧪 Running Automated Tests

Run the complete test suite (all 53 tests):

```powershell
.\backend\.venv\Scripts\python.exe -m pytest backend/tests -v
```

Test breakdown:
- `test_detector.py` (14 tests): Email, phone, API key, password regex and overlap resolution.
- `test_masker.py` (8 tests): Placeholder assignment, repeated entity reuse, safe string formatting.
- `test_api.py` (19 tests): Health, prompt scan, approval validation, session isolation, error cases.
- `test_forward.py` (12 tests): Approved prompt forwarding, gate enforcement, mock provider offline operation, network timeout, error sanitization.

---

## 🔒 Security Guarantees in Phase 3A

1. **Approved Prompt Forwarding Only**:
   The `/api/forward` endpoint rejects any request if the session has not been explicitly approved via `/api/approve`. Tampered prompts trigger an immediate `400 Bad Request`.
2. **Zero-Leak Forwarding**:
   Only the sanitized string with placeholders (e.g., `[EMAIL_1]`) is sent to the AI provider. Original prompt text, user secrets, session mappings, and API keys are **never** passed to providers.
3. **Safe Error Masking**:
   Upstream errors, HTTP statuses, and timeouts are sanitized. Authorization headers, endpoint URLs, and system credentials are never echoed to clients or logs.
4. **Offline Deterministic Mock**:
   The built-in mock provider allows 100% offline development and demonstration without risking accidental external network leakage or requiring cloud API keys.
5. **Sanitized AI Responses**:
   AI responses remain sanitized with placeholders intact during Phase 3A. Unmasking is strictly reserved for the next phase.

---

## ⚠️ Current Limitations (Honest Privacy Boundary)

- **Unmasking Pending (Phase 3B)**: AI responses currently return sanitized text with placeholders intact. Restoring sensitive values requires Phase 3B's safe response validator and unmasker.
- **In-Memory Volatile Sessions**: Ephemeral session mappings reside in single-node RAM with a 15-minute TTL. Server restarts invalidate active sessions.
- **Heuristic Pattern Scope**: Rule-based detection protects structured PII (emails, phones, API keys, passwords) but cannot detect conversational secrets without semantic structure.

---

## 🔮 Phase 3B Preview: Safe Response Unmasking

In Phase 3B:
1. `POST /api/unmask` will take an AI response containing placeholders.
2. The engine will validate placeholders against the registered session mapping to prevent hallucinated placeholders (e.g. inventing `[EMAIL_99]`).
3. Valid placeholders will be safely restored with their original values for the user.
