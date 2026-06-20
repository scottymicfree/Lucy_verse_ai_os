# retrieval.py
"""Retrieval engine for Lucy's Memory Battalion.

Provides:
- Full‑text search over episodes and entities (SQLite FTS5).
- Vector similarity search using stored embeddings (cosine similarity).
- Graph‑based multi‑hop traversal via GraphEngine.
- Reciprocal Rank Fusion (RRF) to combine results.

All operations are read‑only; no mutations occur.
"""

import sqlite3
import numpy as np
from typing import List, Dict, Any, Tuple

from .graph_schema import get_connection
from .graph_engine import GraphEngine
from .embedding import embed_text

# -----------------------------------------------------------------------------
# Helper utilities
# -----------------------------------------------------------------------------

def _cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """Return cosine similarity between two 1‑D float32 vectors."""
    if a.size == 0 or b.size == 0:
        return 0.0
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))


def _rrf(scores: List[Tuple[str, float]], k: int = 60) -> Dict[str, float]:
    """Reciprocal Rank Fusion.

    `scores` is a list of (id, rank) pairs where rank starts at 1 for the top item.
    Returns a dict mapping ids to fused scores.
    """
    fused: Dict[str, float] = {}
    for doc_id, rank in scores:
        fused[doc_id] = fused.get(doc_id, 0.0) + 1.0 / (k + rank)
    return fused

# -----------------------------------------------------------------------------
# Retrieval engine
# -----------------------------------------------------------------------------
class RetrievalEngine:
    """Encapsulates the three retrieval modalities.

    The class is lightweight; it opens a read‑only SQLite connection on demand
    and re‑uses a GraphEngine instance for graph traversals.
    """

    def __init__(self):
        self.conn = get_connection()
        self.conn.row_factory = sqlite3.Row
        self.graph = GraphEngine()

    # ---------------------------------------------------------------------
    # Full‑text search (FTS5) over episodes and entity names
    # ---------------------------------------------------------------------
    def fts_search(self, query: str, limit: int = 20) -> List[Dict[str, Any]]:
        """Search episodes.payload and entities.name using SQLite FTS5.

        Returns a list of dicts with keys: ``type`` ("episode"/"entity"), ``id``,
        ``snippet`` (for episodes) or ``name`` (for entities), and ``rank``.
        """
        cur = self.conn.cursor()
        results: List[Dict[str, Any]] = []
        # Episodes payload FTS – create virtual table on first call if missing.
        cur.execute(
            "CREATE VIRTUAL TABLE IF NOT EXISTS episodes_fts USING fts5(payload, content='episodes', content_rowid='id')"
        )
        cur.execute("INSERT OR REPLACE INTO episodes_fts(ROWID, payload) SELECT id, payload FROM episodes")
        cur.execute(
            "SELECT rowid as id, snippet(episodes_fts, -1, '<b>', '</b>', '...', 10) as snippet "
            "FROM episodes_fts WHERE episodes_fts MATCH ? LIMIT ?",
            (query, limit),
        )
        for i, row in enumerate(cur, start=1):
            results.append({"type": "episode", "id": row["id"], "snippet": row["snippet"], "rank": i})
        # Entity name FTS – virtual table on demand.
        cur.execute(
            "CREATE VIRTUAL TABLE IF NOT EXISTS entities_fts USING fts5(name, content='entities', content_rowid='id')"
        )
        cur.execute("INSERT OR REPLACE INTO entities_fts(ROWID, name) SELECT id, name FROM entities")
        cur.execute(
            "SELECT rowid as id, name FROM entities_fts WHERE entities_fts MATCH ? LIMIT ?",
            (query, limit),
        )
        for i, row in enumerate(cur, start=1):
            results.append({"type": "entity", "id": row["id"], "name": row["name"], "rank": i})
        return results

    # ---------------------------------------------------------------------
    # Vector similarity search over entity embeddings
    # ---------------------------------------------------------------------
    def vector_search(self, text: str, top_k: int = 20) -> List[Dict[str, Any]]:
        """Embed `text` and return the `top_k` most similar entities.

        Returns list of dicts: ``id``, ``name``, ``similarity``, ``rank``.
        """
        query_vec = embed_text(text)
        cur = self.conn.cursor()
        cur.execute("SELECT id, name, embedding FROM entities WHERE embedding IS NOT NULL")
        scores: List[Tuple[int, float, str]] = []
        for row in cur:
            blob = row["embedding"]
            vec = np.frombuffer(blob, dtype=np.float32)
            sim = _cosine_similarity(query_vec, vec)
            scores.append((row["id"], sim, row["name"]))
        # Sort by similarity descending
        scores.sort(key=lambda x: x[1], reverse=True)
        results: List[Dict[str, Any]] = []
        for rank, (eid, sim, name) in enumerate(scores[:top_k], start=1):
            results.append({"type": "entity", "id": eid, "name": name, "similarity": sim, "rank": rank})
        return results

    # ---------------------------------------------------------------------
    # Graph‑based multi‑hop traversal
    # ---------------------------------------------------------------------
    def graph_search(self, start_name: str, hops: int = 2, limit: int = 20) -> List[Dict[str, Any]]:
        """Return nodes reachable from `start_name` within `hops`.

        Results are dicts: ``id``, ``name``, ``type``, ``relation``, ``weight``, ``rank``.
        """
        results_raw = self.graph.traverse(start_name, hops=hops)
        # Rank by weight descending, then truncate.
        results_raw.sort(key=lambda x: x["weight"], reverse=True)
        results: List[Dict[str, Any]] = []
        for rank, r in enumerate(results_raw[:limit], start=1):
            results.append({
                "type": "graph",
                "id": r["dst"],
                "name": r["name"],
                "entity_type": r["type"],
                "relation": r["relation"],
                "weight": r["weight"],
                "rank": rank,
            })
        return results

    # ---------------------------------------------------------------------
    # Fusion of modalities using Reciprocal Rank Fusion (RRF)
    # ---------------------------------------------------------------------
    def fused_search(self, query: str, hops: int = 2, top_k: int = 20) -> List[Dict[str, Any]]:
        """Perform FTS, vector, and graph searches and fuse results via RRF.

        Returns a ranked list of document identifiers with a combined score.
        """
        fts = self.fts_search(query, limit=top_k)
        vec = self.vector_search(query, top_k=top_k)
        # For graph we need a starting entity – use the first entity from FTS if any.
        start_entity = None
        for item in fts:
            if item["type"] == "entity":
                start_entity = item["name"]
                break
        graph = self.graph_search(start_entity or query, hops=hops, limit=top_k) if start_entity else []
        # Build rank lists
        rank_lists: List[Tuple[str, int]] = []
        for i, item in enumerate(fts, start=1):
            rank_lists.append((f"fts:{item['type']}:{item['id']}", i))
        for i, item in enumerate(vec, start=1):
            rank_lists.append((f"vec:{item['id']}", i))
        for i, item in enumerate(graph, start=1):
            rank_lists.append((f"graph:{item['id']}", i))
        fused = _rrf(rank_lists)
        # Sort fused scores descending
        sorted_fused = sorted(fused.items(), key=lambda x: x[1], reverse=True)[:top_k]
        # Convert back to a generic format for the caller.
        results: List[Dict[str, Any]] = []
        for doc_id, score in sorted_fused:
            src, kind, identifier = doc_id.split(":", 2)
            results.append({"source": src, "kind": kind, "identifier": identifier, "rrf_score": score})
        return results

    def close(self):
        """Clean up DB connection and GraphEngine."""
        self.conn.close()
        self.graph.close()

# End of retrieval.py
