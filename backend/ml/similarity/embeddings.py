"""Complaint similarity: sentence-transformers if available, else TF-IDF cosine."""
from __future__ import annotations

from typing import Any

import numpy as np

from ml.complaint_classifier.preprocess import clean_text

_ST_MODEL = None
_ST_NAME = "sentence-transformers/all-MiniLM-L6-v2"


def embed_texts(texts: list[str]) -> tuple[np.ndarray, str]:
    cleaned = [clean_text(t) or "empty" for t in texts]
    try:
        import sentence_transformers  # noqa: F401
        return _st_embed(cleaned), "minilm-v1"
    except Exception:
        return _tfidf_embed(cleaned), "tfidf-cosine-v1"


def _st_embed(texts: list[str]) -> np.ndarray:
    global _ST_MODEL
    from sentence_transformers import SentenceTransformer

    if _ST_MODEL is None:
        _ST_MODEL = SentenceTransformer(_ST_NAME)
    vecs = _ST_MODEL.encode(texts, normalize_embeddings=True, show_progress_bar=False)
    return np.asarray(vecs, dtype=float)


def _tfidf_embed(texts: list[str]) -> np.ndarray:
    from sklearn.feature_extraction.text import TfidfVectorizer

    from sklearn.preprocessing import normalize

    vec = TfidfVectorizer(ngram_range=(1, 2), min_df=1)
    X = vec.fit_transform(texts)
    return np.asarray(normalize(X, norm="l2").toarray(), dtype=float)


def cosine_top_k(
    query_vec: np.ndarray,
    matrix: np.ndarray,
    ids: list[str],
    k: int = 5,
    exclude_id: str | None = None,
) -> list[dict[str, Any]]:
    if matrix.size == 0 or not ids:
        return []
    q = query_vec.reshape(-1)
    denom = (np.linalg.norm(matrix, axis=1) * (np.linalg.norm(q) + 1e-9)) + 1e-9
    sims = matrix @ q / denom
    order = np.argsort(-sims)
    out = []
    for i in order:
        cid = ids[i]
        if exclude_id and cid == exclude_id:
            continue
        out.append({
            "case_id": cid,
            "similarity": round(float(sims[i]), 4),
            "label": "Potentially related",
        })
        if len(out) >= k:
            break
    return out
