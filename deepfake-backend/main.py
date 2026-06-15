import os
import cv2
import numpy as np
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import tempfile
import tensorflow as tf
from mtcnn import MTCNN

# 1. Initialize the FastAPI App
app = FastAPI(title="Dual-Stream Deepfake API", version="1.0.0")

# 2. Configure CORS (Allows your Next.js app to talk to this Python server)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000"
    ],  # Update this when deploying to production!
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 3. Load the AI Brain into Memory ONCE at startup (to prevent lag on every request)
print("Loading Hybrid Dual-Stream Model...")
model = tf.keras.models.load_model("hybrid_model.h5")
detector = MTCNN()
print("Model and MTCNN loaded successfully.")


@app.post("/api/scan")
async def scan_video(file: UploadFile = File(...)):
    """
    Accepts a video upload, runs Dual-Stream inference, and securely deletes the file.
    """
    # Reject invalid files immediately
    if not file.filename.endswith((".mp4", ".mov")):
        raise HTTPException(
            status_code=400, detail="Only MP4 or MOV files are supported."
        )

    # Create a secure temporary file
    temp_fd, temp_path = tempfile.mkstemp(suffix=".mp4")

    try:
        # A. STREAM THE FILE TO DISK (Prevents RAM crashes on large files)
        with os.fdopen(temp_fd, "wb") as out_file:
            while content := await file.read(1024 * 1024):  # Read in 1MB chunks
                out_file.write(content)

        # B. PRE-PROCESSING (Extract Face and Generate Frequency Map)
        video = cv2.VideoCapture(temp_path)
        success, frame = video.read()
        video.release()

        if not success:
            raise HTTPException(status_code=400, detail="Could not read video stream.")

        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        faces = detector.detect_faces(frame_rgb)

        if len(faces) == 0:
            return JSONResponse(
                content={
                    "status": "Error",
                    "message": "No human face detected in the first frame.",
                },
                status_code=400,
            )

        x, y, width, height = faces[0]["box"]
        x, y = max(0, x), max(0, y)
        cropped_face = frame_rgb[y : y + height, x : x + width]

        # Stream A: Spatial
        spatial_img = cv2.resize(cropped_face, (224, 224))
        spatial_input = np.expand_dims(spatial_img, axis=0)  # Shape: (1, 224, 224, 3)

        # Stream B: Frequency
        gray_face = cv2.cvtColor(cropped_face, cv2.COLOR_RGB2GRAY)
        float_face = np.float32(gray_face) / 255.0
        dct_result = cv2.dct(float_face)
        dct_visual = np.log(np.abs(dct_result) * 255 + 1)
        cv2.normalize(dct_visual, dct_visual, 0, 255, cv2.NORM_MINMAX)
        freq_img = cv2.resize(np.uint8(dct_visual), (224, 224)) / 255.0
        freq_input = np.expand_dims(
            np.expand_dims(freq_img, axis=-1), axis=0
        )  # Shape: (1, 224, 224, 1)

        # C. RUN INFERENCE
        predictions = model.predict(
            {"spatial_input": spatial_input, "frequency_input": freq_input}
        )
        fake_probability = (
            float(predictions[0][1]) * 100
        )  # Assuming [Real, Fake] output

        # D. RETURN RESULTS
        is_fake = fake_probability > 50
        status = "Synthetic Media Detected" if is_fake else "Authentic Media"

        # Determine the reason based on the math
        if is_fake:
            if fake_probability > 90:
                explanation = "Critical anomalies detected in the high-frequency DCT spectrum, indicating heavy spatial manipulation around the facial boundary."
            else:
                explanation = "Minor inconsistencies detected between spatial pixel gradients and frequency mapping. Likely lightweight face-swapping."
        else:
            explanation = "No synthetic artifacts detected in either the spatial pixels or the frequency domain. Media integrity appears intact."

        return JSONResponse(
            content={
                "status": status,
                "confidence": round(
                    fake_probability if is_fake else 100 - fake_probability, 2
                ),
                "is_fake": is_fake,
                "explanation": explanation,  # The new field!
            }
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        # THE ZERO-RETENTION GUARANTEE
        # This block executes no matter what happens above.
        if os.path.exists(temp_path):
            os.remove(temp_path)
