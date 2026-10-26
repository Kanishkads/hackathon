# LocalShield AI — Backend API & Session Management (Phase 2)

LocalShield AI is a Privacy-First AI Gateway designed for secure, leak-proof LLM interactions. It scans user prompts for sensitive entities (emails, phone numbers, API keys, passwords), substitutes them with deterministic placeholders (e.g., `[EMAIL_1]`, `[PHONE_1]`), and requires explicit server-side approval before any data can be forwarded externally.

---

## 📁 Project Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py                  # FastAPI application entry point, CORS, routers
│   ├── core/
│   │   ├── __init__.py
│   │   ├── config.py            # Security limits, TTLs, metadata
│   │   └── session.py           # In-memory ephemeral session manager & approval gate
│   ├── models/
│   │   ├── __init__.py
│   │   └── schemas.py           # Pydantic request/response schemas (no secrets leaked!)
│   ├── api/
│   │   ├── __init__.py
│   │   └── routes.py            # /api/health, /api/scan, /api/approve, /api/session
│   └── engine/
│       ├── __init__.py
│       ├── detector.py          # Regex & heuristic sensitive entity detector (Phase 1)
│       └── masker.py            # Placeholder mapping & sanitization engine (Phase 1)
├── tests/
│   ├── __init__.py
│   ├── test_detector.py         # 14 tests for entity detection rules
│   ├── test_masker.py           # 8 tests for placeholder generation & consistency
│   └── test_api.py              # 19 tests for FastAPI routes, approval & sessions
├── requirements.txt
└── README.md
```

---

## 🚀 Getting Started (Windows PowerShell)

All commands below should be executed in Windows PowerShell from the `backend/` directory or root workspace.

### 1. Activate the Virtual Environment

From the project root (`c:\Users\BARANEEDHARAN\Desktop\localshield`):

```powershell
# Activate the existing virtual environment
.\backend\.venv\Scripts\Activate.ps1
```

> **Note**: If PowerShell shows an `Execution_Policies` restriction, run:
> ```powershell
> Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
> ```

### 2. Install Dependencies

Ensure all required packages are installed:

```powershell
pip install -r backend/requirements.txt
```

### 3. Start the FastAPI Server

Run the gateway server locally with live reload:

```powershell
python -m uvicorn app.main:app --reload --app-dir backend --host 127.0.0.1 --port 8000
```

The gateway will be accessible at:
- **API Base**: `http://127.0.0.1:8000`
- **Health Check**: `http://127.0.0.1:8000/api/health`

### 4. Interactive Swagger UI Documentation

Open your browser and navigate to:
👉 **[http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)**

From the Swagger UI, you can interactively test:
- `GET /api/health`: Verify gateway status.
- `POST /api/scan`: Submit a prompt and receive the sanitized preview and temporary `session_id`.
- `POST /api/approve`: Submit the approved sanitized prompt to validate the approval gate.
- `GET /api/session/{session_id}/status`: Inspect active session lifecycle and expiration.

---

## 🧪 Running Automated Tests

Run the full pytest suite (all 41 tests):

```powershell
# From project root using the venv python
.\backend\.venv\Scripts\python.exe -m pytest backend/tests -v
```

Or if your venv is activated:

```powershell
pytest backend/tests -v
```

---

## 🔒 Security Architecture & Guarantees

1. **Zero-Leak Response Guarantee**:
   The API response structure explicitly omits original sensitive values, character spans, and raw secrets. Only assigned placeholders, detected types, and confidence levels are returned.
2. **Ephemeral In-Memory Mapping**:
   Placeholder-to-secret mappings (`[EMAIL_1]` ➔ `user@example.com`) are held **exclusively in volatile server RAM** with an expiration TTL (default 15 minutes). No raw secrets are stored on disk, in SQLite, or in log files.
3. **Cryptographically Secure Session IDs**:
   Session identifiers use `secrets.token_urlsafe(32)` (256 bits of entropy), rendering session IDs unguessable.
4. **Server-Side Approval Validation**:
   The gateway does not trust a client-provided boolean `user_approved: true`. During `/api/scan`, a cryptographic SHA-256 hash of the sanitized prompt is recorded. The `/api/approve` endpoint verifies that the submitted prompt text matches the hash before granting approval status.
5. **Session Isolation**:
   Every prompt scan generates an independent session dictionary with thread-safe locking. Placeholders or mappings cannot be accessed or cross-referenced across sessions.

---

## ⚠️ Current Limitations (Honest Privacy Boundary)

- **Prototype In-Memory Store**: Mappings do not persist across backend process restarts and are stored on a single node. Multi-instance scaling in production would require an encrypted distributed cache (e.g., Redis with KMS).
- **Heuristic Pattern Boundaries**: Pattern-based rules excel at structured data (RFC emails, formatted phone numbers, recognizable API keys) but cannot reliably catch unstructured conversational secrets (e.g., *"the secret answer to my security question is blue sky"*).
- **Human-in-the-Loop Required**: Always inspect the sanitized prompt preview returned by `/api/scan` before sending approval.

---

## 🔮 Phase 3 Preview: How Approval Will Be Used

In Phase 3 (External AI Forwarding & Response Unmasking):
1. The client will call `POST /api/forward` with `{ "session_id": "...", "sanitized_prompt": "..." }`.
2. The server will reject the request with HTTP 403 Forbidden unless the session has been explicitly verified via the server-side approval gate.
3. Only the **sanitized prompt** is ever transmitted to the external LLM provider.
4. When the LLM responds containing placeholders (e.g. `[EMAIL_1]`), the response unmasker validates the placeholders against the session mapping and restores the original values locally for the user.
