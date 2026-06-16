"""Application configuration loaded from environment variables.

Uses Pydantic BaseSettings to provide type-safe, validated configuration
with sensible defaults for local development. All magic numbers and
hardcoded values from the original codebase are centralized here.

Environment variables can be set in a ``.env`` file in the backend root
directory, or passed directly via the shell environment.
"""

from functools import lru_cache

from pydantic_settings import BaseSettings


# ---------------------------------------------------------------------------
# File Extension Constants
# ---------------------------------------------------------------------------

VIDEO_EXTENSIONS: frozenset[str] = frozenset({".mp4", ".mov"})
IMAGE_EXTENSIONS: frozenset[str] = frozenset({".jpg", ".jpeg", ".png", ".webp"})


class Settings(BaseSettings):
    """Central configuration for the Dual-Stream Deepfake API.

    Attributes:
        app_title: Display name shown in the OpenAPI docs.
        app_version: Semantic version of the API.
        cors_origins: Comma-separated list of allowed CORS origins.
        huggingface_repo_id: HuggingFace Hub repository for model weights.
        huggingface_filename: Name of the model file in the HF repository.
        local_model_path: Optional override to load from a local file instead
            of downloading from HuggingFace. Set for offline or dev use.
        max_upload_bytes: Maximum allowed upload size in bytes (default 50 MB).
        allowed_extensions: File extensions accepted by the scan endpoint.
        input_size: Height and width to resize face crops before inference.
        fake_threshold: Percentage above which a video is classified as fake.
        critical_threshold: Percentage above which the explanation escalates
            to "critical anomalies detected".
        max_sample_frames: Number of frames to uniformly sample from a video.
        chunk_size_bytes: Size of chunks when streaming uploads to disk.
        log_level: Python logging level name.
    """

    # --- Application ---
    app_title: str = "Dual-Stream Deepfake API"
    app_version: str = "1.1.0"

    # --- CORS ---
    cors_origins: list[str] = ["http://localhost:3000"]

    # --- Model Source ---
    huggingface_repo_id: str = "AkohTech/deepfake-dual-stream-model"
    huggingface_filename: str = "hybrid_model.h5"
    local_model_path: str | None = None

    # --- Upload Constraints ---
    max_upload_bytes: int = 52_428_800  # 50 MB
    allowed_extensions: set[str] = {
        # Video formats
        ".mp4", ".mov",
        # Image formats
        ".jpg", ".jpeg", ".png", ".webp",
    }

    # --- Inference Parameters ---
    input_size: int = 224
    fake_threshold: float = 50.0
    critical_threshold: float = 90.0
    max_sample_frames: int = 8
    chunk_size_bytes: int = 1_048_576  # 1 MB

    # --- Logging ---
    log_level: str = "INFO"

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "case_sensitive": False,
    }


def is_image_file(filename: str) -> bool:
    """Check if a filename has an image extension.

    Args:
        filename: The name of the uploaded file.

    Returns:
        True if the file extension is a recognized image format.
    """
    import os
    ext = os.path.splitext(filename)[1].lower()
    return ext in IMAGE_EXTENSIONS


def is_video_file(filename: str) -> bool:
    """Check if a filename has a video extension.

    Args:
        filename: The name of the uploaded file.

    Returns:
        True if the file extension is a recognized video format.
    """
    import os
    ext = os.path.splitext(filename)[1].lower()
    return ext in VIDEO_EXTENSIONS


@lru_cache
def get_settings() -> Settings:
    """Return a cached singleton of the application settings.

    Using ``lru_cache`` ensures the ``.env`` file is read only once
    per process, avoiding redundant I/O on every request.
    """
    return Settings()
