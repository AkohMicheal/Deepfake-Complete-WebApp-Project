"""Application entry point — FastAPI app factory.

Creates the FastAPI application with:
    - Lifespan-managed model and detector loading (singleton pattern).
    - CORS middleware configured from environment variables.
    - Upload size limiting middleware.
    - Global exception handlers for sanitized error responses.
    - The scan API router.

Run with:
    uvicorn app.main:app --reload
"""

import logging
from contextlib import asynccontextmanager
from collections.abc import AsyncGenerator

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from mtcnn import MTCNN
from starlette.middleware.base import BaseHTTPMiddleware

from app.config import get_settings
from app.exceptions import register_exception_handlers
from app.routes.scan import router as scan_router
from app.services.model_loader import load_keras_model


# ---------------------------------------------------------------------------
# Logging Configuration
# ---------------------------------------------------------------------------

settings = get_settings()

logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Upload Size Limiting Middleware
# ---------------------------------------------------------------------------

class LimitUploadSizeMiddleware(BaseHTTPMiddleware):
    """Reject requests whose Content-Length exceeds the configured limit.

    This provides an early rejection before the request body is streamed,
    preventing disk/memory exhaustion from oversized uploads.
    """

    def __init__(self, app: FastAPI, max_upload_bytes: int) -> None:
        super().__init__(app)
        self.max_upload_bytes = max_upload_bytes

    async def dispatch(self, request: Request, call_next):
        if request.method in ("POST", "PUT", "PATCH"):
            content_length = request.headers.get("content-length")
            if content_length and int(content_length) > self.max_upload_bytes:
                return Response(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    content="File exceeds maximum allowed upload size.",
                )
        return await call_next(request)


# ---------------------------------------------------------------------------
# Application Lifespan (Startup / Shutdown)
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Manage expensive resources across the application lifecycle.

    Loads the Keras model and MTCNN detector once at startup, stores
    them in ``app.state``, and cleans up on shutdown.
    """
    logger.info("Starting up — loading model and face detector...")

    app.state.model = load_keras_model(settings)
    app.state.detector = MTCNN()

    logger.info("Startup complete. Ready to accept requests.")
    yield

    # Cleanup
    app.state.model = None
    app.state.detector = None
    logger.info("Shutdown complete. Resources released.")


# ---------------------------------------------------------------------------
# App Factory
# ---------------------------------------------------------------------------

app = FastAPI(
    title=settings.app_title,
    version=settings.app_version,
    lifespan=lifespan,
)

# Middleware (order matters: outermost middleware runs first)
app.add_middleware(
    LimitUploadSizeMiddleware,
    max_upload_bytes=settings.max_upload_bytes,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Exception handlers
register_exception_handlers(app)

# Routes
app.include_router(scan_router)
