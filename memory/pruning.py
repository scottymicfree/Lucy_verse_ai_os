# src/memory/pruning.py
"""Memory pruning utilities.

This module provides functions to keep Lucy's cognitive graph healthy by
* removing stale episodes (age > 90 days)
* deleting low‑importance entities and their dangling edges/aliases
* compacting the database to reclaim space.

All operations are performed directly on the SQLite DB defined in
`graph_schema.py`.  Foreign‑key cascade constraints ensure that when an
entity is removed its edges and aliases are also deleted.
"""

import sqlite3
import os
from datetime import datetime, timedelta
from typing import List

# Re‑use the DB helper from graph_schema
from .graph_schema import get_connection, DB_PATH

# ---------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------
# Episodes older than this will be pruned (default: 90 days)
MAX_EPISODE_AGE_DAYS: int = 90
# Importance threshold below which entities are considered forgettable
MIN_ENTITY_IMPORTANCE: float = 0.05

# ---------------------------------------------------------------------
# Helper utilities
# ---------------------------------------------------------------------
def _isoformat(dt: datetime) -> str:
    """Return an ISO‑8601 string with a trailing ``Z`` for UTC."""
    return dt.isoformat(timespec="seconds") + "Z"

# ---------------------------------------------------------------------
# Pruning functions
# ---------------------------------------------------------------------
def prune_old_episodes(max_age_days: int = MAX_EPISODE_AGE_DAYS) -> int:
    """Delete episodes older than ``max_age_days``.

    Returns the number of rows removed.
    """
    cutoff = datetime.utcnow() - timedelta(days=max_age_days)
    cutoff_iso = _isoformat(cutoff)
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("DELETE FROM episodes WHERE timestamp < ?", (cutoff_iso,))
    removed = cur.rowcount
    conn.commit()
    conn.close()
    return removed


def prune_low_importance_entities(min_importance: float = MIN_ENTITY_IMPORTANCE) -> int:
    """Delete entities whose ``importance`` is below ``min_importance``.

    Because ``entities`` has ``ON DELETE CASCADE`` foreign‑key constraints,
    related rows in ``edges`` and ``aliases`` are automatically removed.
    Returns the number of entities deleted.
    """
    conn = get_connection()
    cur = conn.cursor()
    # Select IDs to delete first (SQLite does not support RETURNING on DELETE in older versions)
    cur.execute("SELECT id FROM entities WHERE importance < ?", (min_importance,))
    to_delete = [row["id"] for row in cur.fetchall()]
    if not to_delete:
        conn.close()
        return 0
    # Perform the deletion using a parameter list
    placeholders = ",".join(["?" for _ in to_delete])
    cur.execute(f"DELETE FROM entities WHERE id IN ({placeholders})", to_delete)
    removed = cur.rowcount
    conn.commit()
    conn.close()
    return removed


def compact_database() -> None:
    """Run ``VACUUM`` to reclaim free space after pruning operations."""
    conn = get_connection()
    conn.execute("VACUUM")
    conn.commit()
    conn.close()


def prune_all() -> dict:
    """Execute the full pruning pipeline.

    Returns a dictionary with counts of removed episodes and entities.
    """
    episodes_removed = prune_old_episodes()
    entities_removed = prune_low_importance_entities()
    # Compact after deletions
    compact_database()
    return {
        "episodes_removed": episodes_removed,
        "entities_removed": entities_removed,
    }

# ---------------------------------------------------------------------
# Simple command‑line interface for manual testing (not used by the core).
# ---------------------------------------------------------------------
if __name__ == "__main__":
    stats = prune_all()
    print(f"Pruned {stats['episodes_removed']} episodes and {stats['entities_removed']} low‑importance entities.")
