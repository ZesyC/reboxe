"""Download an immutable model revision without executing remote repository code."""
import argparse
import re
from huggingface_hub import snapshot_download

parser = argparse.ArgumentParser()
parser.add_argument("--revision", required=True)
parser.add_argument("--model", default="Qwen/Qwen3-VL-4B-Instruct")
args = parser.parse_args()
if not re.fullmatch(r"[a-f0-9]{40}", args.revision):
    parser.error("Pass a reviewed 40-character model commit hash")
snapshot_download(repo_id=args.model, revision=args.revision,
                  allow_patterns=["*.json", "*.safetensors", "*.txt", "*.jinja", "LICENSE*", "README.md"],
                  ignore_patterns=["*.py", "*.bin", "*.pkl", "*.pt"])
