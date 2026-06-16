"""Custom exception hierarchy and FastAPI exception handlers.

Defines application-specific exceptions that map cleanly to HTTP status
codes. Global handlers convert these into sanitized JSON responses,
preventing internal details (file paths, library versions) from leaking
to clients.

Usage:
    Raise any ``DeepfakeAPIError`` subclass in service or route code.
    The global handlers registered in ``main.py`` will catch them and
    return the appropriate HTTP response automatically.
"""

import logging

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Exception Hierarchy
# ---------------------------------------------------------------------------

class DeepfakeAPIError(Exception):
    """Base exception for all application-level errors.

    Attributes:
        message: A user-safe description of what went wrong.
        status_code: The HTTP status code to return to the client.
    """

    def __init__(self, message: str = "An internal error occurred.", status_code: int = 500) -> None:
        self.message = message
        self.status_code = status_code
        super().__init__(self.message)


class VideoProcessingError(DeepfakeAPIError):
    """Raised when a video file cannot be opened, decoded, or read."""

    def __init__(self, message: str = "Could not process the uploaded video.") -> None:
        super().__init__(message=message, status_code=400)


class ImageProcessingError(DeepfakeAPIError):
    """Raised when an image file cannot be opened, decoded, or read."""

    def __init__(self, message: str = "Could not process the uploaded image.") -> None:
        super().__init__(message=message, status_code=400)


class FaceNotFoundError(DeepfakeAPIError):
    """Raised when MTCNN fails to detect a face in a given frame."""

    def __init__(self, message: str = "No human face detected in the video.") -> None:
        super().__init__(message=message, status_code=400)


class FileTooLargeError(DeepfakeAPIError):
    """Raised when the uploaded file exceeds ``MAX_UPLOAD_BYTES``."""

    def __init__(self, max_bytes: int) -> None:
        max_mb = max_bytes / (1024 * 1024)
        super().__init__(
            message=f"File exceeds the maximum allowed size of {max_mb:.0f} MB.",
            status_code=413,
        )


class UnsupportedFileTypeError(DeepfakeAPIError):
    """Raised when the file extension is not in ``ALLOWED_EXTENSIONS``."""

    def __init__(self, allowed: set[str]) -> None:
        formatted = ", ".join(sorted(allowed))
        super().__init__(
            message=f"Unsupported file type. Allowed formats: {formatted}",
            status_code=400,
        )


# ---------------------------------------------------------------------------
# Global Exception Handlers
# ---------------------------------------------------------------------------

def register_exception_handlers(app: FastAPI) -> None:
    """Attach global exception handlers to the FastAPI application.

    Args:
        app: The FastAPI application instance.
    """

    @app.exception_handler(DeepfakeAPIError)
    async def handle_app_error(_request: Request, exc: DeepfakeAPIError) -> JSONResponse:
        """Return a structured JSON error for known application exceptions."""
        return JSONResponse(
            status_code=exc.status_code,
            content={"status": "Error", "message": exc.message},
        )

    @app.exception_handler(Exception)
    async def handle_unexpected_error(_request: Request, exc: Exception) -> JSONResponse:
        """Catch-all for unexpected errors. Logs the full traceback but
        returns only a generic message to the client."""
        logger.exception("Unhandled exception: %s", exc)
        return JSONResponse(
            status_code=500,
            content={
                "status": "Error",
                "message": "An unexpected server error occurred. Please try again later.",
            },
        )
