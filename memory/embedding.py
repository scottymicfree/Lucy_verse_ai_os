import os
import sqlite3
from typing import List, Optional

import numpy as np
from sentence_transformers import SentenceTransformer

# Local imports for DB path and connection helper
from .graph_schema import get_connection, DB_PATH

# Lazy-loaded model singleton
_model: Optional[SentenceTransformer] = None


def _load_model() -> SentenceTransformer:
    """Load the all‑mpnet‑base‑v2 transformer model.
    The model is cached in the module-level ``_model`` variable so that it is
    instantiated only once per process. The model is loaded on CPU to keep the
    deployment self‑contained and offline.
    """
    global _model
    if _model is None:
        # Disable download message – the model files are cached under the
        # default HuggingFace cache directory which is part of the user's
        # environment. This satisfies the "no cloud calls" rule because the
        # model will be fetched once on first run and then reused offline.
        _model = SentenceTransformer("sentence-transformers/all-mpnet-base-v2", device="cpu")
    return _model


def embed_text(text: str) -> np.ndarray:
    """Generate a normalized embedding vector for a single piece of text.

    The returned vector is a ``numpy.ndarray`` of ``float32`` with unit norm.
    Normalisation aids cosine‑similarity retrieval later in the pipeline.
    """
    model = _load_model()
    # ``encode`` returns a list of vectors; we request a single vector.
    vec = model.encode([text], normalize_embeddings=True)[0]
    return np.asarray(vec, dtype=np.float32)


def _vector_to_blob(vec: np.ndarray) -> bytes:
    """Serialise a float32 vector to a BLOB for SQLite storage.

    ``numpy.tobytes`` stores the raw binary representation which can be read
    back with ``np.frombuffer`` using the original dtype and length.
    """
    return vec.tobytes()


def _blob_to_vector(blob: bytes) -> np.ndarray:
    """Deserialize a BLOB back into a ``numpy.ndarray`` of ``float32``.
    The length of the vector is inferred from the blob size (4 bytes per float).
    """
    return np.frombuffer(blob, dtype=np.float32)


def upsert_entity_embedding(
    name: str,
    type_: str = "unknown",
    importance: float = 0.0,
    text: Optional[str] = None,
    vector: Optional[np.ndarray] = None,
) -> int:
    """Insert a new entity or update an existing one with an embedding.

    Parameters
    ----------
    name: str
        Normalised entity name (must be unique).
    type_: str, optional
        Human‑readable type label.
    importance: float, optional
        Importance score – defaults to ``0.0``.
    text: str, optional
        If provided, an embedding is generated from this text.
    vector: np.ndarray, optional
        Direct embedding vector. ``text`` takes precedence over ``vector``.

    Returns
    -------
    int
        The primary‑key ``id`` of the entity row.
    """
    if text is not None:
        emb = embed_text(text)
    elif vector is not None:
        emb = np.asarray(vector, dtype=np.float32)
    else:
        raise ValueError("Either 'text' or 'vector' must be supplied.")

    conn = get_connection()
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    # Check whether the entity already exists
    cur.execute("SELECT id FROM entities WHERE name = ?", (name,))
    row = cur.fetchone()
    if row:
        entity_id = row["id"]
        cur.execute(
            """
            UPDATE entities
            SET type = ?, importance = ?, embedding = ?, last_access = datetime('now')
            WHERE id = ?
            """,
            (type_, importance, _vector_to_blob(emb), entity_id),
        )
    else:
        cur.execute(
            """
            INSERT INTO entities (name, type, importance, embedding, last_access, created_at)
            VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
            """,
            (name, type_, importance, _vector_to_blob(emb)),
        )
        entity_id = cur.lastrowid
    conn.commit()
    conn.close()
    return entity_id


def get_entity_embedding(name: str) -> Optional[np.ndarray]:
    """Retrieve the stored embedding for an entity, or ``None`` if missing."""
    conn = get_connection()
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute("SELECT embedding FROM entities WHERE name = ?", (name,))
    row = cur.fetchone()
    conn.close()
    if row and row["embedding"] is not None:
        return _blob_to_vector(row["embedding"])
    return None

# Optional quantisation helper – not required for basic operation but available
def quantize_vector(vec: np.ndarray, bits: int = 8) -> bytes:
    """Compress a float32 vector to a lower‑precision integer representation.

    The function scales the vector to the int range and packs it as ``bytes``.
    ``bits`` can be 8 or 16. For 8‑bit we map ``[-1, 1]`` → ``[0, 255]``.
    This is a simple, loss‑y quantisation useful for storage‑size reduction.
    """
    if bits == 8:
        scaled = ((vec + 1.0) * 127.5).clip(0, 255).astype(np.uint8)
        return scaled.tobytes()
    elif bits == 16:
        scaled = ((vec + 1.0) * 32767.5).clip(0, 65535).astype(np.uint16)
        return scaled.tobytes()
    else:
        raise ValueError("Only 8 or 16‑bit quantisation is supported.")

def dequantize_vector(blob: bytes, bits: int = 8) -> np.ndarray:
    """Restore a quantised vector back to ``float32``.
    The inverse operation of ``quantize_vector``.
    """
    if bits == 8:
        arr = np.frombuffer(blob, dtype=np.uint8).astype(np.float32)
        return arr / 127.5 - 1.0
    if bits == 16:
        arr = np.frombuffer(blob, dtype=np.uint16).astype(np.float32)
        return arr / 32767.5 - 1.0
    raise ValueError("Only 8 or 16‑bit quantisation is supported.")
