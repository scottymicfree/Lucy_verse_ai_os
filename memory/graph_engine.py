import json
import sqlite3
import os
import datetime
from typing import List, Dict, Any, Tuple, Optional

# Optional in‑memory graph analysis
try:
    import networkx as nx
except ImportError:  # pragma: no cover
    nx = None

# Re‑use the DB helper from graph_schema
from .graph_schema import get_connection, DB_PATH

# Simple data structures for clarity
class Entity:
    def __init__(self, name: str, type_: str = "unknown", importance: float = 0.0):
        self.name = name
        self.type = type_
        self.importance = importance
        self.last_access: Optional[str] = None
        self.created_at: Optional[str] = None
        self.id: Optional[int] = None

class Edge:
    def __init__(self, src_id: int, dst_id: int, relation: str = "RELATED", weight: float = 1.0,
                 valid_from: Optional[str] = None, valid_to: Optional[str] = None):
        self.src_id = src_id
        self.dst_id = dst_id
        self.relation = relation
        self.weight = weight
        self.valid_from = valid_from
        self.valid_to = valid_to

class GraphEngine:
    """Core persistent graph engine.

    All data lives in the SQLite file defined in ``graph_schema.py``.
    ``NetworkX`` is used only for temporary in‑memory traversals when the
    library is available.
    """

    def __init__(self):
        # Ensure schema exists – ``graph_schema.init_schema`` is idempotent.
        from .graph_schema import init_schema
        init_schema()
        self.conn = get_connection()
        self.conn.row_factory = sqlite3.Row

    # ---------------------------------------------------------------------
    # Entity handling
    # ---------------------------------------------------------------------
    def upsert_entity(self, name: str, type_: str = "unknown", importance: float = 0.0) -> int:
        """Insert a new entity or update an existing one.

        Returns the integer primary‑key ``id`` of the entity.
        """
        now = datetime.datetime.utcnow().isoformat() + "Z"
        cur = self.conn.cursor()
        # Try to fetch existing entity
        cur.execute("SELECT id, importance FROM entities WHERE name = ?", (name,))
        row = cur.fetchone()
        if row:
            # Update importance if the new value is higher
            new_imp = max(row["importance"], importance)
            cur.execute(
                "UPDATE entities SET type = ?, importance = ?, last_access = ?, created_at = COALESCE(created_at, ?) WHERE id = ?",
                (type_, new_imp, now, now, row["id"]),
            )
            self.conn.commit()
            return row["id"]
        else:
            cur.execute(
                "INSERT INTO entities (name, type, importance, last_access, created_at) VALUES (?,?,?,?,?)",
                (name, type_, importance, now, now),
            )
            self.conn.commit()
            return cur.lastrowid

    def add_alias(self, entity_id: int, alias: str) -> None:
        """Create an alias for an existing entity. Duplicate aliases are ignored."""
        try:
            self.conn.execute(
                "INSERT OR IGNORE INTO aliases (entity_id, alias) VALUES (?,?)",
                (entity_id, alias),
            )
            self.conn.commit()
        except sqlite3.IntegrityError as e:
            # Entity may have been removed – ignore silently
            pass

    # ---------------------------------------------------------------------
    # Edge handling
    # ---------------------------------------------------------------------
    def upsert_edge(
        self,
        src_id: int,
        dst_id: int,
        relation: str = "RELATED",
        weight: float = 1.0,
        valid_from: Optional[str] = None,
        valid_to: Optional[str] = None,
    ) -> None:
        """Insert or update a directed edge.

        If the edge already exists we increment its weight (simple reinforcement).
        """
        now = datetime.datetime.utcnow().isoformat() + "Z"
        cur = self.conn.cursor()
        cur.execute(
            "SELECT weight FROM edges WHERE src = ? AND dst = ? AND relation = ?",
            (src_id, dst_id, relation),
        )
        row = cur.fetchone()
        if row:
            new_weight = row["weight"] + weight
            cur.execute(
                "UPDATE edges SET weight = ?, valid_from = COALESCE(?, valid_from), valid_to = COALESCE(?, valid_to) "
                "WHERE src = ? AND dst = ? AND relation = ?",
                (new_weight, valid_from, valid_to, src_id, dst_id, relation),
            )
        else:
            cur.execute(
                "INSERT INTO edges (src, dst, relation, weight, created_at, valid_from, valid_to) "
                "VALUES (?,?,?,?,?,?,?)",
                (src_id, dst_id, relation, weight, now, valid_from, valid_to),
            )
        self.conn.commit()

    # ---------------------------------------------------------------------
    # Retrieval helpers
    # ---------------------------------------------------------------------
    def get_entity_by_name(self, name: str) -> Optional[Dict[str, Any]]:
        cur = self.conn.execute("SELECT * FROM entities WHERE name = ?", (name,))
        row = cur.fetchone()
        return dict(row) if row else None

    def get_entity_by_id(self, entity_id: int) -> Optional[Dict[str, Any]]:
        cur = self.conn.execute("SELECT * FROM entities WHERE id = ?", (entity_id,))
        row = cur.fetchone()
        return dict(row) if row else None

    def resolve_alias(self, alias: str) -> Optional[int]:
        """Return the entity_id for an alias, or ``None`` if not found."""
        cur = self.conn.execute("SELECT entity_id FROM aliases WHERE alias = ?", (alias,))
        row = cur.fetchone()
        return row["entity_id"] if row else None

    # ---------------------------------------------------------------------
    # Graph traversal & summary
    # ---------------------------------------------------------------------
    def traverse(self, start_name: str, hops: int = 2) -> List[Dict[str, Any]]:
        """Return a list of reachable nodes up to ``hops`` from ``start_name``.

        The result is a flat list of dictionaries describing each node and the edge
        that led to it.
        """
        start = self.get_entity_by_name(start_name)
        if not start:
            return []
        visited = {start["id"]}
        frontier = [(start["id"], 0)]
        results: List[Dict[str, Any]] = []
        while frontier:
            current_id, depth = frontier.pop(0)
            if depth >= hops:
                continue
            cur = self.conn.execute(
                "SELECT e.id, e.name, e.type, ed.relation, ed.weight "
                "FROM edges ed JOIN entities e ON ed.dst = e.id "
                "WHERE ed.src = ?",
                (current_id,),
            )
            for row in cur:
                nid = row["id"]
                if nid not in visited:
                    visited.add(nid)
                    results.append({
                        "src": current_id,
                        "dst": nid,
                        "name": row["name"],
                        "type": row["type"],
                        "relation": row["relation"],
                        "weight": row["weight"],
                    })
                    frontier.append((nid, depth + 1))
        return results

    def summary_for_ui(self, limit: int = 20) -> Dict[str, Any]:
        """Return a compact summary for the UI.

        ``limit`` caps the number of nodes returned.
        """
        cur = self.conn.execute(
            "SELECT id, name, type, importance, last_access FROM entities ORDER BY importance DESC LIMIT ?",
            (limit,),
        )
        nodes = [dict(row) for row in cur]
        # Fetch top edges by weight
        cur = self.conn.execute(
            "SELECT src, dst, relation, weight FROM edges ORDER BY weight DESC LIMIT ?",
            (limit * 2,),
        )
        edges = [dict(row) for row in cur]
        return {"nodes": nodes, "edges": edges}

    # ---------------------------------------------------------------------
    # Utility – optional NetworkX view
    # ---------------------------------------------------------------------
    def as_networkx(self) -> Any:
        """Create a NetworkX DiGraph representation of the stored graph.

        Returns ``None`` if NetworkX is not installed.
        """
        if nx is None:
            return None
        G = nx.DiGraph()
        cur = self.conn.execute("SELECT id, name, type FROM entities")
        for row in cur:
            G.add_node(row["id"], name=row["name"], type=row["type"])
        cur = self.conn.execute(
            "SELECT src, dst, relation, weight FROM edges"
        )
        for row in cur:
            G.add_edge(row["src"], row["dst"], relation=row["relation"], weight=row["weight"])
        return G

    # ---------------------------------------------------------------------
    # Clean‑up
    # ---------------------------------------------------------------------
    def close(self):
        self.conn.close()

# Helper function for external callers
def get_graph_engine() -> GraphEngine:
    """Factory returning a ready‑to‑use GraphEngine instance.
    Useful for quick one‑off scripts.
    """
    return GraphEngine()
