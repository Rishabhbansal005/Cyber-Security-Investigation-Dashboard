"""CCID — Cyber Crime Investigation Dashboard
FastAPI Backend Application
"""
# Load .env FIRST — before any other imports — so os.environ is fully
# populated when pydantic-settings caches the Settings singleton.
import os as _os
from pathlib import Path as _Path
try:
    from dotenv import load_dotenv as _load_dotenv
    _env_path = _Path(__file__).parent.parent / ".env"
    _load_dotenv(dotenv_path=_env_path, override=True)
except ImportError:
    pass  # python-dotenv not installed; rely on pydantic-settings

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from app.core.config import settings
from app.core.limiter import limiter
from app.api.v1.router import api_router

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    logger.info("🚀 CCID Backend API starting up...")
    logger.info(f"   Environment: {settings.environment}")
    logger.info(f"   Supabase URL: {settings.supabase_url or 'NOT SET'}")

    def _warmup_image_auth():
        try:
            from ml.image_auth.predict import ensure_loaded
            ensure_loaded()
        except Exception as exc:
            logger.warning("image_auth warmup skipped: %s", exc)
        try:
            from ml.image_auth_ai.predict import ensure_loaded as ensure_ai, model_available
            if model_available():
                ensure_ai()
        except Exception as exc:
            logger.warning("image_auth_ai warmup skipped: %s", exc)

    import threading
    threading.Thread(target=_warmup_image_auth, daemon=True, name="image-auth-warmup").start()
    yield
    logger.info("🛑 CCID Backend API shutting down...")


app = FastAPI(
    title="CCID — Cyber Crime Investigation Dashboard",
    description=(
        "Digital forensics and cybercrime investigation platform API. "
        "Manage cases, evidence, findings, timelines, and generate reports."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

# Attach the limiter to the app state so slowapi middleware can find it
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ============================================================
# Middleware
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

if settings.environment == "production":
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=["*"])

# ============================================================
# Routes
# ============================================================

app.include_router(api_router)


@app.get("/", tags=["Root"])
async def root():
    return {
        "service": "CCID Backend API",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/api/v1/health",
    }
