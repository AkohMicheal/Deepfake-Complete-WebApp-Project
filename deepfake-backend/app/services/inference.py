"""Model inference and result interpretation.

Encapsulates the prediction logic and the business rules for converting
a raw fake probability into a structured, human-readable scan result.
"""

import logging
from dataclasses import dataclass

import numpy as np
import tensorflow as tf

from app.config import Settings

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Result Data Class
# ---------------------------------------------------------------------------

@dataclass(frozen=True, slots=True)
class ScanResult:
    """Structured output of a deepfake scan.

    Attributes:
        status: Human-readable verdict, e.g. "Synthetic Media Detected".
        confidence: Rounded confidence percentage (0–100).
        is_fake: Boolean flag for programmatic consumption.
        explanation: Technical reasoning for the verdict.
        frames_analyzed: Number of frames that contributed to the verdict.
    """

    status: str
    confidence: float
    is_fake: bool
    explanation: str
    frames_analyzed: int


# ---------------------------------------------------------------------------
# Explanation Templates
# ---------------------------------------------------------------------------

_EXPLANATIONS = {
    "critical_fake": (
        "Critical anomalies detected in the high-frequency DCT spectrum, "
        "indicating heavy spatial manipulation around the facial boundary."
    ),
    "minor_fake": (
        "Minor inconsistencies detected between spatial pixel gradients "
        "and frequency mapping. Likely lightweight face-swapping."
    ),
    "authentic": (
        "No synthetic artifacts detected in either the spatial pixels or "
        "the frequency domain. Media integrity appears intact."
    ),
}


# ---------------------------------------------------------------------------
# Single-Frame Prediction
# ---------------------------------------------------------------------------

def predict_single_frame(
    model: tf.keras.Model,
    spatial_input: np.ndarray,
    frequency_input: np.ndarray,
) -> float:
    """Run inference on a single prepared frame.

    Args:
        model: The loaded Keras dual-stream model.
        spatial_input: Spatial stream tensor of shape ``(1, 224, 224, 3)``.
        frequency_input: Frequency stream tensor of shape ``(1, 224, 224, 1)``.

    Returns:
        Fake probability as a percentage (0–100).
    """
    predictions = model.predict(
        {"spatial_input": spatial_input, "frequency_input": frequency_input},
        verbose=0,
    )
    # Output shape is (1, 2) → [real_prob, fake_prob]
    return float(predictions[0][1]) * 100


# ---------------------------------------------------------------------------
# Multi-Frame Aggregation
# ---------------------------------------------------------------------------

def aggregate_predictions(probabilities: list[float]) -> float:
    """Aggregate per-frame fake probabilities into a single score.

    Uses **max-voting**: the video-level fake probability is the highest
    per-frame probability. This ensures that even a single manipulated
    frame triggers detection.

    Args:
        probabilities: List of per-frame fake probabilities (0–100).

    Returns:
        Aggregated fake probability (0–100).
    """
    if not probabilities:
        return 0.0
    return max(probabilities)


# ---------------------------------------------------------------------------
# Result Interpretation
# ---------------------------------------------------------------------------

def interpret_result(
    fake_probability: float,
    frames_analyzed: int,
    settings: Settings,
) -> ScanResult:
    """Convert a raw fake probability into a structured scan result.

    Args:
        fake_probability: Aggregated fake probability (0–100).
        frames_analyzed: Number of frames that were successfully analyzed.
        settings: Application settings for threshold configuration.

    Returns:
        A ``ScanResult`` with status, confidence, explanation, and metadata.
    """
    is_fake = fake_probability > settings.fake_threshold

    if is_fake:
        status = "Synthetic Media Detected"
        confidence = round(fake_probability, 2)
        explanation = (
            _EXPLANATIONS["critical_fake"]
            if fake_probability > settings.critical_threshold
            else _EXPLANATIONS["minor_fake"]
        )
    else:
        status = "Authentic Media"
        confidence = round(100 - fake_probability, 2)
        explanation = _EXPLANATIONS["authentic"]

    return ScanResult(
        status=status,
        confidence=confidence,
        is_fake=is_fake,
        explanation=explanation,
        frames_analyzed=frames_analyzed,
    )
