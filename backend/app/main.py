"""LocalShield AI - Main FastAPI Application.

Entry point for the LocalShield AI Privacy Gateway backend.
Configures CORS, registers API routers, and enforces security headers.
"""

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes import router as api_router
from app.core.config import PRIVACY_DISCLAIMER, SERVICE_NAME, VERSION

app = FastAPI(
    title=SERVICE_NAME,
    version=VERSION,
    description=(
        "LocalShield AI is a Privacy-First AI Gateway that detects sensitive information "
        "in user prompts, generates structured placeholders, and enforces human-in-the-loop "
        "approval before forwarding requests externally.\n\n"
        f"**Privacy Notice**: {PRIVACY_DISCLAIMER}"
    ),
    docs_url="/docs",
    redoc_url="/redoc",
)

# Configure CORS for local development and frontend interaction
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust in production to specific frontend domains
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Custom validation handler to return clean error messages without system internals."""
    errors = exc.errors()
    # Extract readable issue descriptions
    readable_details = []
    for err in errors:
        loc = " -> ".join(str(l) for l in err.get("loc", []))
        msg = err.get("msg", "Invalid value")
        readable_details.append(f"{loc}: {msg}")

    return JSONResponse(
        status_code=422,
        content={
            "detail": "Request validation failed.",
            "errors": readable_details
        }
    )


# Register API endpoints under /api
app.include_router(api_router)


@app.get("/", tags=["Root"])
def root():
    """Root endpoint welcoming developers and linking to Swagger documentation."""
    return {
        "service": SERVICE_NAME,
        "version": VERSION,
        "docs": "/docs",
        "health": "/api/health"
    }
