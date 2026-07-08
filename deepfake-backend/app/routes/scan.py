"""Scan endpoint — the core API route for deepfake detection.

This module contains the POST /api/scan route handler. It orchestrates
the full pipeline: file validation → temp storage → frame extraction
(video) or image decode → per-frame preprocessing + inference →
aggregation → cleanup → response.

Supports both video uploads (MP4, MOV) and image uploads (JPEG, PNG, WebP).
For videos, multiple frames are uniformly sampled across the duration.
For images, the single image is processed directly.

The route uses a synchronous ``def`` (not ``async def``) so that FastAPI
automatically runs it in an external thread pool. This prevents the
CPU-bound OpenCV, MTCNN, and TensorFlow operations from blocking the
async event loop, allowing the server to handle concurrent requests.
"""

import logging
import os
import tempfile

import cv2
import numpy as np
import tensorflow as tf
from fastapi import APIRouter, Depends, UploadFile, File
from mtcnn import MTCNN

from app.config import Settings, is_image_file
from app.dependencies import get_model, get_detector, get_app_settings
from app.exceptions import (
    FaceNotFoundError,
    FileTooLargeError,
    ImageProcessingError,
    UnsupportedFileTypeError,
    VideoProcessingError,
)
from app.services.inference import (
    ScanResult,
    aggregate_predictions,
    interpret_result,
    predict_single_frame,
)
from app.services.preprocessing import detect_and_crop_face, prepare_dual_stream_inputs
from app.services.video import extract_frames

logger = logging.getLogger(__name__)
router = APIRouter()


# ---------------------------------------------------------------------------
# Response Serialization Helper
# ---------------------------------------------------------------------------

def _result_to_dict(result: ScanResult, media_type: str) -> dict:
    """Convert a ``ScanResult`` dataclass to a JSON-serializable dict.

    Maintains backward compatibility with the original API response
    schema expected by the frontend, and adds ``media_type`` metadata.
    """
    return {
        "status": result.status,
        "confidence": result.confidence,
        "is_fake": result.is_fake,
        "explanation": result.explanation,
        "frames_analyzed": result.frames_analyzed,
        "media_type": media_type,
    }


# ---------------------------------------------------------------------------
# File Validation
# ---------------------------------------------------------------------------

def _validate_upload(file: UploadFile, settings: Settings) -> None:
    """Validate the uploaded file's extension and declared size.

    Args:
        file: The uploaded file from the request.
        settings: Application settings with allowed extensions and size limit.

    Raises:
        UnsupportedFileTypeError: If the file extension is not allowed.
        FileTooLargeError: If Content-Length exceeds the limit.
    """
    filename = file.filename or ""
    ext = os.path.splitext(filename)[1].lower()

    if ext not in settings.allowed_extensions:
        raise UnsupportedFileTypeError(settings.allowed_extensions)

    # Check declared Content-Length if available
    if file.size is not None and file.size > settings.max_upload_bytes:
        raise FileTooLargeError(settings.max_upload_bytes)


# ---------------------------------------------------------------------------
# Temp File Management
# ---------------------------------------------------------------------------

def _stream_to_temp_file(file: UploadFile, settings: Settings) -> str:
    """Stream the uploaded file to a secure temporary file on disk.

    Reads the upload in chunks to prevent RAM exhaustion on large files.
    Also enforces the size limit during streaming as a second check
    (in case Content-Length was spoofed or absent).

    Uses the original file extension for the temp suffix so that
    downstream readers (OpenCV) handle the file correctly.

    Args:
        file: The uploaded file.
        settings: Application settings with chunk size and size limit.

    Returns:
        Absolute path to the temporary file.

    Raises:
        FileTooLargeError: If the actual bytes written exceed the limit.
    """
    filename = file.filename or "upload.bin"
    ext = os.path.splitext(filename)[1].lower() or ".bin"
    temp_fd, temp_path = tempfile.mkstemp(suffix=ext)
    bytes_written = 0

    try:
        with os.fdopen(temp_fd, "wb") as out:
            while True:
                chunk = file.file.read(settings.chunk_size_bytes)
                if not chunk:
                    break
                bytes_written += len(chunk)
                if bytes_written > settings.max_upload_bytes:
                    raise FileTooLargeError(settings.max_upload_bytes)
                out.write(chunk)
    except FileTooLargeError:
        # Clean up the temp file before re-raising
        if os.path.exists(temp_path):
            os.remove(temp_path)
        raise

    return temp_path


# ---------------------------------------------------------------------------
# Image Loading
# ---------------------------------------------------------------------------

def _load_image(image_path: str) -> np.ndarray:
    """Load an image file from disk using OpenCV.

    Args:
        image_path: Absolute path to the image file.

    Returns:
        BGR numpy array of the image.

    Raises:
        ImageProcessingError: If the image cannot be decoded.
    """
    frame = cv2.imread(image_path)
    if frame is None:
        raise ImageProcessingError(
            "Could not decode the uploaded image. Ensure it is a valid "
            "JPEG, PNG, or WebP file."
        )
    return frame


# ---------------------------------------------------------------------------
# Route Handler
# ---------------------------------------------------------------------------

@router.post("/api/scan")
def scan_media(
    file: UploadFile = File(...),
    model: tf.keras.Model = Depends(get_model),
    detector: MTCNN = Depends(get_detector),
    settings: Settings = Depends(get_app_settings),
) -> dict:
    """Scan an image or video for deepfake manipulation.

    Accepts a media upload, extracts frames (video) or loads the image
    directly, runs dual-stream inference on each frame, aggregates
    results via max-voting, and returns a structured verdict. The
    uploaded file is securely deleted after processing regardless of
    success or failure.

    Args:
        file: The uploaded media file (MP4, MOV, JPEG, PNG, or WebP).
        model: Injected Keras model.
        detector: Injected MTCNN face detector.
        settings: Injected application settings.

    Returns:
        JSON dict with status, confidence, is_fake, explanation,
        frames_analyzed, and media_type fields.
    """
    _validate_upload(file, settings)
    temp_path = _stream_to_temp_file(file, settings)
    filename = file.filename or ""

    try:
        # Branch based on media type
        if is_image_file(filename):
            return _process_image(temp_path, model, detector, settings)
        else:
            return _process_video(temp_path, model, detector, settings)

    finally:
        # Zero-retention guarantee: delete temp file no matter what
        if os.path.exists(temp_path):
            os.remove(temp_path)
            logger.debug("Temp file deleted: %s", temp_path)


# ---------------------------------------------------------------------------
# Image Processing Pipeline
# ---------------------------------------------------------------------------

def _process_image(
    image_path: str,
    model: tf.keras.Model,
    detector: MTCNN,
    settings: Settings,
) -> dict:
    """Process a single image through the deepfake detection pipeline.

    Args:
        image_path: Path to the temporary image file.
        model: The loaded Keras model.
        detector: The MTCNN detector.
        settings: Application settings.

    Returns:
        Serialized scan result dict.
    """
    frame = _load_image(image_path)

    try:
        face_crop = detect_and_crop_face(frame, detector)
    except FaceNotFoundError:
        raise FaceNotFoundError(
            "No human face could be detected in the uploaded image."
        )

    spatial, frequency = prepare_dual_stream_inputs(
        face_crop, settings.input_size
    )
    probability = predict_single_frame(model, spatial, frequency)
    result = interpret_result(probability, 1, settings)

    logger.info(
        "Image scan complete: %s (%.2f%% confidence)",
        result.status,
        result.confidence,
    )
    return _result_to_dict(result, media_type="image")


# ---------------------------------------------------------------------------
# Video Processing Pipeline
# ---------------------------------------------------------------------------

def _process_video(
    video_path: str,
    model: tf.keras.Model,
    detector: MTCNN,
    settings: Settings,
) -> dict:
    """Process a video through the multi-frame deepfake detection pipeline.

    Reads frames sequentially one by one from disk, extracts face crops,
    and immediately discards full-size frames to minimize memory usage.

    Args:
        video_path: Path to the temporary video file.
        model: The loaded Keras model.
        detector: The MTCNN detector.
        settings: Application settings.

    Returns:
        Serialized scan result dict.
    """
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise VideoProcessingError("Could not open the video file for reading.")

    try:
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        max_frames = settings.max_sample_frames

        # Compute sampling indices
        if total_frames <= 0:
            # Fallback: read sequentially up to max_frames
            indices = list(range(max_frames))
            use_sequential = True
        else:
            from app.services.video import _compute_sample_indices
            indices = _compute_sample_indices(total_frames, max_frames)
            use_sequential = False

        probabilities: list[float] = []

        for i, idx in enumerate(indices):
            if use_sequential:
                success, frame = cap.read()
            else:
                cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
                success, frame = cap.read()

            if not success:
                if use_sequential:
                    break
                logger.warning("Failed to read frame at index %d, skipping.", idx)
                continue

            try:
                # Extract face crop from the current frame
                face_crop = detect_and_crop_face(frame, detector)
                
                # Delete full-resolution frame immediately to free memory
                del frame
                
                # Preprocess face crop and run inference
                spatial, frequency = prepare_dual_stream_inputs(
                    face_crop, settings.input_size
                )
                prob = predict_single_frame(model, spatial, frequency)
                probabilities.append(prob)
                logger.debug("Frame %d/%d (index %d): %.2f%% fake probability", i + 1, len(indices), idx, prob)
            except FaceNotFoundError:
                logger.warning("Frame %d/%d (index %d): no face detected, skipping.", i + 1, len(indices), idx)
                continue
            except Exception as exc:
                logger.error("Error analyzing frame %d: %s", i + 1, exc)
                continue

        if not probabilities:
            raise FaceNotFoundError(
                "No human face could be detected in any of the sampled frames."
            )

        aggregated = aggregate_predictions(probabilities)
        result = interpret_result(aggregated, len(probabilities), settings)

        logger.info(
            "Video scan complete: %s (%.2f%% confidence, %d frames)",
            result.status,
            result.confidence,
            result.frames_analyzed,
        )
        return _result_to_dict(result, media_type="video")

    finally:
        cap.release()
