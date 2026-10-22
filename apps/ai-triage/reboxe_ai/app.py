import hashlib
import hmac
import logging
import os
import re
import tempfile
import threading
from pathlib import Path
from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile
from starlette.concurrency import run_in_threadpool
from . import model
from .media import MAX_BYTES, image_frames, probe_video, video_frames
from .policy import review_result

app = FastAPI(title="REBOXE private evidence triage", docs_url=None, redoc_url=None, openapi_url=None)
inference_slot = threading.BoundedSemaphore(1)
logger = logging.getLogger("reboxe.ai")


def authenticate(authorization: str = Header(default="")):
    expected = os.environ.get("AI_SERVICE_TOKEN", "")
    if len(expected) < 32:
        raise HTTPException(503, "AI service is not configured")
    if not hmac.compare_digest(authorization, f"Bearer {expected}"):
        raise HTTPException(401, "Unauthorized")


@app.get("/health/live")
def live():
    return {"status": "ok", "mode": "ASSISTED_REVIEW", "modelLoaded": model.load_model.cache_info().currsize > 0}


def analyze(data: bytes, mime_type: str, checksum: str):
    if not inference_slot.acquire(blocking=False):
        raise HTTPException(429, "AI worker is busy; retry later")
    try:
        with tempfile.TemporaryDirectory(prefix="reboxe-triage-") as directory:
            if mime_type.startswith("image/"):
                frames, duration, timestamps = image_frames(data)
            else:
                evidence = Path(directory) / "evidence.bin"
                evidence.write_bytes(data)
                frames, duration, timestamps = video_frames(evidence, Path(directory))
            assessment = model.assess(frames, timestamps)
            return review_result(assessment, checksum=checksum, model_id=model.MODEL_ID,
                                 revision=model.MODEL_REVISION, duration=duration, timestamps=timestamps)
    except HTTPException:
        raise
    except ValueError:
        raise HTTPException(422, "Media or model output could not be validated; manual review is required") from None
    except Exception:
        logger.error("triage_failed")
        raise HTTPException(503, "AI analysis unavailable; manual review is required") from None
    finally:
        inference_slot.release()


@app.post("/v1/triage", dependencies=[Depends(authenticate)])
async def triage(file: UploadFile = File(...), checksum: str = Form(...)):
    data, mime_type = await read_upload(file, checksum)
    return await run_in_threadpool(analyze, data, mime_type, checksum)


@app.post("/v1/media/inspect", dependencies=[Depends(authenticate)])
async def inspect(file: UploadFile = File(...), checksum: str = Form(...)):
    data, mime_type = await read_upload(file, checksum)
    def probe():
        try:
            if mime_type.startswith("image/"):
                image_frames(data)
                return {"checksum": checksum, "durationSeconds": 0}
            with tempfile.TemporaryDirectory(prefix="reboxe-probe-") as directory:
                path = Path(directory) / "evidence.bin"
                path.write_bytes(data)
                return {"checksum": checksum, "durationSeconds": probe_video(path)}
        except Exception:
            raise HTTPException(422, "Media could not be validated") from None
    return await run_in_threadpool(probe)


async def read_upload(file: UploadFile, checksum: str):
    try:
        if not re.fullmatch(r"[a-f0-9]{64}", checksum):
            raise HTTPException(422, "Invalid SHA-256 checksum")
        if file.content_type not in {"image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm", "video/quicktime"}:
            raise HTTPException(422, "Unsupported evidence media type")
        data = bytearray()
        while chunk := await file.read(1024 * 1024):
            data.extend(chunk)
            if len(data) > MAX_BYTES:
                raise HTTPException(413, "Evidence exceeds 20 MiB")
        if not data or not hmac.compare_digest(hashlib.sha256(data).hexdigest(), checksum):
            raise HTTPException(422, "Evidence checksum mismatch")
        return bytes(data), file.content_type
    finally:
        await file.close()
