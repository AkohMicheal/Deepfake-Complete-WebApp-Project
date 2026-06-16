"""Model loading service with HuggingFace Hub integration.

Downloads model weights from HuggingFace Hub on first run and caches
them locally for subsequent startups. Supports an optional local path
override for offline development.
"""

import logging
from pathlib import Path

import tensorflow as tf

from app.config import Settings

logger = logging.getLogger(__name__)


def load_keras_model(settings: Settings) -> tf.keras.Model:
    """Load the Keras dual-stream model from HuggingFace Hub or local disk.

    Resolution order:
        1. If ``settings.local_model_path`` is set and the file exists, load
           from that path directly (useful for offline development).
        2. Otherwise, download from HuggingFace Hub using ``hf_hub_download``.
           The file is cached in the default HuggingFace cache directory
           (~/.cache/huggingface/hub) and reused on subsequent calls.

    Args:
        settings: Application settings containing the HuggingFace repo ID,
            filename, and optional local model path.

    Returns:
        A compiled Keras model ready for inference.

    Raises:
        FileNotFoundError: If ``local_model_path`` is set but does not exist.
        RuntimeError: If the model cannot be loaded from any source.
    """
    model_path = _resolve_model_path(settings)
    logger.info("Loading Keras model from: %s", model_path)

    try:
        model = tf.keras.models.load_model(model_path)
    except Exception as exc:
        raise RuntimeError(
            f"Failed to load model from {model_path}. "
            "Ensure the file is a valid Keras model (.h5 or SavedModel)."
        ) from exc

    logger.info("Model loaded successfully.")
    return model


def _resolve_model_path(settings: Settings) -> str:
    """Determine the local filesystem path to the model weights.

    Args:
        settings: Application settings.

    Returns:
        Absolute path to the model file on disk.
    """
    # Priority 1: Explicit local override
    if settings.local_model_path:
        local = Path(settings.local_model_path)
        if not local.exists():
            raise FileNotFoundError(
                f"LOCAL_MODEL_PATH is set to '{local}' but the file does not exist."
            )
        return str(local)

    # Priority 2: Download / cache from HuggingFace Hub
    try:
        from huggingface_hub import hf_hub_download
    except ImportError as exc:
        raise RuntimeError(
            "The 'huggingface_hub' package is required to download model weights. "
            "Install it with: pip install huggingface_hub"
        ) from exc

    logger.info(
        "Downloading model from HuggingFace Hub: %s/%s",
        settings.huggingface_repo_id,
        settings.huggingface_filename,
    )
    return hf_hub_download(
        repo_id=settings.huggingface_repo_id,
        filename=settings.huggingface_filename,
    )
