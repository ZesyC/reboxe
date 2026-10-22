"""Hardware smoke test only; does not measure damage detection accuracy."""
import json
import time
import torch
from PIL import Image
from reboxe_ai.model import load_model, MODEL_ID, MODEL_REVISION

started = time.monotonic()
model, processor = load_model()
messages = [{"role": "user", "content": [
    {"type": "image", "image": Image.new("RGB", (64, 64), "red")},
    {"type": "text", "text": "What is the main color? Answer with one word."},
]}]
inputs = processor.apply_chat_template(messages, tokenize=True, add_generation_prompt=True,
                                      return_dict=True, return_tensors="pt").to(model.device)
with torch.inference_mode():
    output = model.generate(**inputs, max_new_tokens=8, do_sample=False)
answer = processor.batch_decode(output[:, inputs.input_ids.shape[1]:], skip_special_tokens=True)[0]
print(json.dumps({"model": MODEL_ID, "revision": MODEL_REVISION, "answer": answer,
                  "elapsedSeconds": round(time.monotonic() - started, 2), "test": "synthetic-color-smoke"}))
