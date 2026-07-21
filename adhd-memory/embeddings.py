"""
Embeddings — Real local embeddings using sentence-transformers.
Model: all-MiniLM-L6-v2 (384 dimensions, ~80MB, runs on CPU)
"""

import os
from typing import List, Optional
from functools import lru_cache

_model = None

def get_model():
    """Lazy-load the sentence-transformers model."""
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer
        # Cache model in /data/huggingface to avoid re-downloading
        cache_dir = os.environ.get("HF_HOME", "/data/huggingface")
        os.makedirs(cache_dir, exist_ok=True)
        _model = SentenceTransformer("all-MiniLM-L6-v2", cache_folder=cache_dir)
    return _model


def generate_embedding(text: str) -> List[float]:
    """Generate a 384-dim embedding for the given text."""
    model = get_model()
    embedding = model.encode(text, normalize_embeddings=True)
    return embedding.tolist()


def generate_embeddings_batch(texts: List[str]) -> List[List[float]]:
    """Generate embeddings for a batch of texts."""
    model = get_model()
    embeddings = model.encode(texts, normalize_embeddings=True)
    return embeddings.tolist()
