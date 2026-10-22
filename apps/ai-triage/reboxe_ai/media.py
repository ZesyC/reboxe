import io
import json
import math
import subprocess
from pathlib import Path
from PIL import Image

MAX_BYTES = 20 * 1024 * 1024
Image.MAX_IMAGE_PIXELS = 16_000_000


def image_frames(data: bytes):
    with Image.open(io.BytesIO(data)) as image:
        if image.format not in {"JPEG", "PNG", "WEBP"} or image.width * image.height > 16_000_000:
            raise ValueError("Unsupported image")
        image.load()
        frame = image.convert("RGB")
        frame.thumbnail((768, 768))
        return [frame], 0.0, [0.0]


def probe_video(path: Path):
    with path.open("rb") as source:
        header = source.read(16)
    if header[4:8] != b"ftyp" and not header.startswith(b"\x1a\x45\xdf\xa3"):
        raise ValueError("Expected an MP4/QuickTime or WebM container")
    probe = subprocess.run([
        "ffprobe", "-v", "error", "-protocol_whitelist", "file,pipe",
        "-show_entries", "format=duration:stream=codec_type,width,height", "-of", "json", str(path)
    ], capture_output=True, timeout=15, check=True)
    metadata = json.loads(probe.stdout)
    duration = float(metadata.get("format", {}).get("duration", 0))
    if not math.isfinite(duration) or not 0 < duration <= 90:
        raise ValueError("Video duration must be between 0 and 90 seconds")
    streams = [item for item in metadata.get("streams", []) if item.get("codec_type") == "video"]
    if len(streams) != 1 or not 0 < streams[0].get("width", 0) <= 4096 or not 0 < streams[0].get("height", 0) <= 4096:
        raise ValueError("Video must have one stream, at most 4096 pixels per dimension")
    return duration


def video_frames(path: Path, output: Path):
    duration = probe_video(path)
    count = min(16, max(1, math.ceil(duration)))
    timestamps = [round(index * duration / count, 3) for index in range(count)]
    frames = []
    for index, time in enumerate(timestamps):
        destination = output / f"frame-{index:02d}.jpg"
        subprocess.run([
            "ffmpeg", "-nostdin", "-v", "error", "-protocol_whitelist", "file,pipe",
            "-ss", str(time), "-i", str(path), "-frames:v", "1", "-an", "-sn", "-dn",
            "-vf", "scale=768:768:force_original_aspect_ratio=decrease", "-threads", "1", str(destination)
        ], capture_output=True, timeout=15, check=True)
        with Image.open(destination) as image:
            frames.append(image.convert("RGB"))
    return frames, duration, timestamps
