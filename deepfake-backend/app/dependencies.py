"""FastAPI dependency injection functions.

Provides accessor functions for shared application state (model, detector)
and configuration. Using ``Depends()`` with these functions makes route
handlers testable — you can override dependencies in tests without
monkeypatching module-level globals.
"""

import tensorflow as tf
from fastapi import Request
from mtcnn import MTCNN

from app.config import Settings, get_settings


def get_model(request: Request) -> tf.keras.Model:
    """Retrieve the loaded Keras model from application state.

    Args:
        request: The incoming FastAPI request (injected automatically).

    Returns:
        The Keras model loaded during application startup.
    """
    return request.app.state.model


def get_detector(request: Request) -> MTCNN:
    """Retrieve the MTCNN face detector from application state.

    Args:
        request: The incoming FastAPI request (injected automatically).

    Returns:
        The MTCNN detector initialized during application startup.
    """
    return request.app.state.detector


def get_app_settings() -> Settings:
    """Retrieve the cached application settings.

    Returns:
        The singleton ``Settings`` instance.
    """
    return get_settings()
