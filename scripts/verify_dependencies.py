"""Verify the pinned numerical and embedding dependencies."""

from __future__ import annotations

import argparse
from importlib import metadata
from pathlib import Path

EXPECTED = {
    "numpy": "1.26.4",
    "scipy": "1.11.4",
    "scikit-learn": "1.4.2",
    "torch": "2.6.0",
    "transformers": "4.46.3",
    "sentence-transformers": "3.3.1",
}
ROOT = Path(__file__).resolve().parent.parent
DEFAULT_LOCAL_MODEL = ROOT / "models" / "embedding"
DEFAULT_REMOTE_MODEL = "paraphrase-multilingual-MiniLM-L12-v2"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--model",
        default=None,
        help="Local model path or Hugging Face model id (defaults to models/embedding when present)",
    )
    args = parser.parse_args()

    for package, expected in EXPECTED.items():
        actual = metadata.version(package)
        if actual.split("+")[0] != expected:
            raise RuntimeError(f"{package}=={expected} required, found {actual}")

    import numpy as np
    import scipy
    import sklearn
    from sentence_transformers import SentenceTransformer

    if np.__version__ != EXPECTED["numpy"] or scipy.__version__ != EXPECTED["scipy"]:
        raise RuntimeError("NumPy/SciPy versions are inconsistent with the lock file")
    print(f"Dependencies OK: numpy={np.__version__}, scipy={scipy.__version__}, sklearn={sklearn.__version__}")

    model_name = args.model or (
        str(DEFAULT_LOCAL_MODEL) if DEFAULT_LOCAL_MODEL.joinpath("model.safetensors").exists() else DEFAULT_REMOTE_MODEL
    )
    local_model = Path(model_name).exists()
    model = SentenceTransformer(model_name, local_files_only=local_model)
    vector = model.encode("依赖验证", normalize_embeddings=True)
    if len(vector) != 384:
        raise RuntimeError(f"Expected 384-dimensional vector, got {len(vector)}")
    print(f"Embedding OK: model={model_name}, dimension={len(vector)}")


if __name__ == "__main__":
    main()
