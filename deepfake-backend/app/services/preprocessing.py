"""Face detection and dual-stream input preparation.

Isolates all image preprocessing logic: MTCNN face detection, bounding
box extraction, and the spatial / frequency stream tensor construction.
Each function is independently testable and reusable.
"""

import cv2
import numpy as np
from mtcnn import MTCNN

from app.exceptions import FaceNotFoundError


# ---------------------------------------------------------------------------
# Face Detection
# ---------------------------------------------------------------------------

def detect_and_crop_face(frame_bgr: np.ndarray, detector: MTCNN) -> np.ndarray:
    """Detect the primary face in a frame and return the cropped region.

    Converts the frame from BGR to RGB (MTCNN expects RGB), runs face
    detection, and crops the bounding box of the highest-confidence face.
    Negative bounding-box coordinates are clamped to zero.

    Args:
        frame_bgr: A single video frame in BGR color space (OpenCV default).
        detector: An initialized MTCNN detector instance.

    Returns:
        Cropped face region as an RGB numpy array.

    Raises:
        FaceNotFoundError: If MTCNN detects no faces in the frame.
    """
    frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
    detections = detector.detect_faces(frame_rgb)

    if not detections:
        raise FaceNotFoundError()

    # Use the first detection (highest confidence by MTCNN default ordering)
    x, y, width, height = detections[0]["box"]
    x, y = max(0, x), max(0, y)
    return frame_rgb[y : y + height, x : x + width]


# ---------------------------------------------------------------------------
# Spatial Stream (Stream A)
# ---------------------------------------------------------------------------

def prepare_spatial_input(face_crop: np.ndarray, size: int = 224) -> np.ndarray:
    """Resize a face crop for the spatial input stream.

    Args:
        face_crop: RGB face crop of arbitrary dimensions.
        size: Target height and width (must match model expectations).

    Returns:
        Float32 array of shape ``(1, size, size, 3)`` with pixel values
        in their original 0–255 range (the model was trained this way).
    """
    resized = cv2.resize(face_crop, (size, size))
    return np.expand_dims(resized, axis=0).astype(np.float32)


# ---------------------------------------------------------------------------
# Frequency Stream (Stream B)
# ---------------------------------------------------------------------------

def prepare_frequency_input(face_crop: np.ndarray, size: int = 224) -> np.ndarray:
    """Compute the DCT frequency map of a face crop.

    Pipeline:
        1. Convert RGB → Grayscale.
        2. Normalize to [0, 1] float32.
        3. Apply Discrete Cosine Transform (DCT).
        4. Log-scale the magnitude for visualization.
        5. Normalize to [0, 255] then scale back to [0, 1].
        6. Resize to ``(size, size)`` and add batch + channel dims.

    Note:
        ``cv2.dct`` requires the input to have even dimensions along
        both axes. Non-square face crops are first resized to
        ``(size, size)`` in grayscale to guarantee compatibility.

    Args:
        face_crop: RGB face crop of arbitrary dimensions.
        size: Target height and width (must match model expectations).

    Returns:
        Float32 array of shape ``(1, size, size, 1)`` with values in [0, 1].
    """
    gray = cv2.cvtColor(face_crop, cv2.COLOR_RGB2GRAY)

    # Resize before DCT to guarantee even dimensions
    gray_resized = cv2.resize(gray, (size, size))
    float_face = gray_resized.astype(np.float32) / 255.0

    dct_result = cv2.dct(float_face)

    # Log-scale visualization of DCT magnitudes
    dct_visual = np.log(np.abs(dct_result) * 255 + 1)
    cv2.normalize(dct_visual, dct_visual, 0, 255, cv2.NORM_MINMAX)

    freq_normalized = dct_visual.astype(np.float32) / 255.0
    return np.expand_dims(np.expand_dims(freq_normalized, axis=-1), axis=0)


# ---------------------------------------------------------------------------
# Combined Preparation
# ---------------------------------------------------------------------------

def prepare_dual_stream_inputs(
    face_crop: np.ndarray, size: int = 224
) -> tuple[np.ndarray, np.ndarray]:
    """Prepare both spatial and frequency inputs from a single face crop.

    Convenience wrapper that calls ``prepare_spatial_input`` and
    ``prepare_frequency_input`` in sequence.

    Args:
        face_crop: RGB face crop of arbitrary dimensions.
        size: Target height and width for both streams.

    Returns:
        Tuple of ``(spatial_input, frequency_input)`` ready for model
        prediction.
    """
    spatial = prepare_spatial_input(face_crop, size)
    frequency = prepare_frequency_input(face_crop, size)
    return spatial, frequency
