"""Video frame extraction with uniform temporal sampling.

Instead of reading only the first frame, this module samples frames at
evenly-spaced intervals across the entire video duration. This prevents
an attacker from bypassing detection by placing an authentic frame at
the start of a manipulated video.
"""

import logging

import cv2
import numpy as np

from app.exceptions import VideoProcessingError

logger = logging.getLogger(__name__)


def extract_frames(video_path: str, max_frames: int = 8) -> list[np.ndarray]:
    """Extract uniformly-sampled frames from a video file.

    Opens the video, determines total frame count, and samples
    ``max_frames`` frames at evenly-spaced intervals. If the video
    contains fewer frames than ``max_frames``, all frames are returned.

    Args:
        video_path: Absolute path to the video file on disk.
        max_frames: Maximum number of frames to extract. Higher values
            improve detection coverage at the cost of inference time.

    Returns:
        List of BGR numpy arrays (OpenCV default color space), one per
        sampled frame. Guaranteed to contain at least one frame.

    Raises:
        VideoProcessingError: If the video cannot be opened or contains
            no readable frames.
    """
    cap = cv2.VideoCapture(video_path)

    if not cap.isOpened():
        raise VideoProcessingError("Could not open the video file for reading.")

    try:
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

        if total_frames <= 0:
            # Fallback: try reading frames sequentially
            return _read_all_frames(cap, max_frames)

        indices = _compute_sample_indices(total_frames, max_frames)
        frames = _read_frames_at_indices(cap, indices)

        if not frames:
            raise VideoProcessingError(
                "Could not read any frames from the video."
            )

        logger.info(
            "Extracted %d frames from %d total (sampling rate: %.1f%%)",
            len(frames),
            total_frames,
            len(frames) / total_frames * 100,
        )
        return frames

    finally:
        cap.release()


def _compute_sample_indices(total_frames: int, max_frames: int) -> list[int]:
    """Compute evenly-spaced frame indices for uniform temporal sampling.

    Args:
        total_frames: Total number of frames in the video.
        max_frames: Desired number of samples.

    Returns:
        Sorted list of integer frame indices.
    """
    if total_frames <= max_frames:
        return list(range(total_frames))

    # Use linspace to get evenly distributed indices across the video
    return [int(i) for i in np.linspace(0, total_frames - 1, max_frames)]


def _read_frames_at_indices(
    cap: cv2.VideoCapture, indices: list[int]
) -> list[np.ndarray]:
    """Seek to specific frame indices and read them.

    Args:
        cap: An open VideoCapture object.
        indices: Sorted list of frame indices to read.

    Returns:
        List of successfully read BGR frames.
    """
    frames: list[np.ndarray] = []

    for idx in indices:
        cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
        success, frame = cap.read()
        if success:
            frames.append(frame)
        else:
            logger.warning("Failed to read frame at index %d, skipping.", idx)

    return frames


def _read_all_frames(
    cap: cv2.VideoCapture, max_frames: int
) -> list[np.ndarray]:
    """Sequential fallback when total frame count is unavailable.

    Reads frames one by one up to ``max_frames``.

    Args:
        cap: An open VideoCapture object.
        max_frames: Maximum number of frames to read.

    Returns:
        List of successfully read BGR frames.

    Raises:
        VideoProcessingError: If no frames could be read at all.
    """
    frames: list[np.ndarray] = []

    for _ in range(max_frames):
        success, frame = cap.read()
        if not success:
            break
        frames.append(frame)

    if not frames:
        raise VideoProcessingError("Video contains no readable frames.")

    return frames
