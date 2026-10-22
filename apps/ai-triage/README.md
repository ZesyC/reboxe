# REBOXE evidence analysis

Private FastAPI service using Qwen3-VL-4B-Instruct (Apache-2.0 model card). Samples up to 16 frames from a maximum 90-second video, verifies SHA-256 and returns structured observations tied to sampled timestamps. All results require human review. It never calls payment APIs or rejects claims. Sampled frames cannot establish continuity or exclude editing.

## Setup

Create a virtual environment, install a hardware-appropriate PyTorch build, then `pip install -r requirements.txt`. FFmpeg/FFprobe must be installed. Run media decoding in a separate resource-limited container with network disabled in production. Keep the service private with reverse-proxy upload/time/concurrency limits. This is an internal endpoint, not a browser endpoint.

Select an immutable commit from https://huggingface.co/Qwen/Qwen3-VL-4B-Instruct/commits/main after reviewing its files/license. Download using `python scripts/download_model.py --revision COMMIT_HASH`. Set `AI_MODEL_REVISION` to that hash and `AI_SERVICE_TOKEN` to a random secret of at least 32 characters. Run `uvicorn reboxe_ai.app:app --host 127.0.0.1 --port 8001 --workers 1`. Downloads may be several GB; no model is downloaded during a request. A missing model returns unavailable and leaves human review available.

Run `python -m unittest discover -s tests`. These are policy tests, not evidence of model accuracy. Inference, throughput and accuracy require target-hardware validation.

## Data

`datasets/registry.json` records sources, licenses, attribution and suitability. VisA has 10,821 images and CC BY 4.0 licensing; its industrial defects differ from unboxing disputes. MVTec AD 2 is excluded from commercial training because its license is non-commercial.

Before fine-tuning: document permitted provenance, redact identities/labels, obtain human annotations, split by seller/package, freeze a target-domain holdout and compare the base model against the tuned model. Measure missed damage, unsupported conclusions, referral rate, latency and category performance. Model confidence is not a calibrated approval probability.

Fine-tuning has not started: no labeled REBOXE unboxing corpus or validated baseline exists yet. Model weights are not stored in Git or represented as a trained REBOXE model.

## Local verification (2026-10-21)

Pinned revision `ebb281ec70b05090aa6165b016eac8ec08e71b17` was downloaded into an ignored local cache. A real CPU inference identified a synthetic red square as “Red” in approximately 127 seconds. This proves model loading/inference only; it is not a damage-detection benchmark. Eight policy/API tests passed, including media inspection without loading the model. Video accuracy, concurrent load and production GPU performance remain unmeasured.

Sources: https://huggingface.co/Qwen/Qwen3-VL-4B-Instruct ; https://github.com/QwenLM/Qwen3-VL ; https://github.com/amazon-science/spot-diff ; https://www.mvtec.com/research-teaching/datasets/mvtec-ad-2 .

