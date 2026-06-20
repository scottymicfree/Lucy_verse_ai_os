# src/memory/memory_engine.py
"""Memory engine – orchestrates the Memory Battalion.

The ``tick`` function is the activation switch that:
1. Pulls recent episodes from :pymod:`episodic`.
2. Extracts entities from each episode payload using :pymod:`entity_extractor`.
3. Upserts entities into the persistent graph via :pymod:`graph_engine`.
4. Generates / updates embeddings for new entities using :pymod:`embedding`.
5. Detects simple causal language ("X leads to Y", "X causes Y") and creates
   ``LEADS_TO`` edges.
6. Executes the pruning pipeline to keep the graph tidy.

All operations are *read‑write* on the SQLite store but do not affect the UI
or cognition loop until the caller explicitly invokes ``tick``.  The function
returns a concise summary useful for logging or debugging.
"""

import os

# Tick interval configuration
MEMORY_TICK_INTERVAL = int(os.getenv("MEMORY_TICK_INTERVAL", "1"))

# Internal turn counter
_tick_counter = 0

def should_tick() -> bool:
    """Return True when the tick should run based on MEMORY_TICK_INTERVAL.

    The counter is incremented by the cognition loop; this function checks
    the modulo condition.
    """
    global _tick_counter
    _tick_counter += 1
    return _tick_counter % MEMORY_TICK_INTERVAL == 0

from .episodic import EpisodicMemory
from .entity_extractor import extract_entities, extract_causal_relations_from_text
from .graph_engine import GraphEngine
from .embedding import upsert_entity_embedding
from .pruning import prune_all

# ---------------------------------------------------------------------
# Helper utilities
# ---------------------------------------------------------------------

def _entity_key(entity: Dict[str, str]) -> str:
    """Return a deterministic key for an entity (its normalised name)."""
    return entity["name"]

# ---------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------

def tick(limit: int = 100) -> Dict[str, Any]:
    """Execute one cognition cycle of the Memory Battalion.

    Parameters
    ----------
    limit: int, optional
        Maximum number of recent episodes to process in this tick.  The default
        of ``100`` mirrors the limit used in :pymeth:`EpisodicMemory.recent`.

    Returns
    -------
    dict
        Summary of work performed – number of episodes processed, entities
        upserted, edges created, and pruning statistics.
    """
    # -----------------------------------------------------------------
    # 1. Load recent episodes
    # -----------------------------------------------------------------
    episodic = EpisodicMemory()
    recent_episodes = episodic.recent(limit=limit)

    if not recent_episodes:
        return {
            "processed_episodes": 0,
            "new_entities": 0,
            "new_edges": 0,
            "pruning": {"episodes_removed": 0, "entities_removed": 0},
        }

    graph = GraphEngine()
    new_entities = set()
    new_edges = 0

    # -----------------------------------------------------------------
    # 2. Process each episode
    # -----------------------------------------------------------------
    for ep in recent_episodes:
        payload = ep.get("payload", {})
        # Ensure payload is a dict for the extractor; if it's a string, try json.
        if isinstance(payload, str):
            try:
                payload = json.loads(payload)
            except Exception:
                # Keep as raw string – extractor will treat it as empty dict.
                payload = {}
        # -----------------------------------------------------------------
        # Entity extraction
        # -----------------------------------------------------------------
        entities = extract_entities(payload)
        for ent in entities:
            name = ent["name"]
            type_ = ent.get("type", "unknown")
            # Upsert entity in the graph – returns its SQLite id.
            entity_id = graph.upsert_entity(name=name, type_=type_, importance=0.0)
            new_entities.add(name)
            # Upsert embedding – we embed the entity name itself for now.
            # ``upsert_entity_embedding`` will create or replace the vector.
            upsert_entity_embedding(name=name, type_=type_, importance=0.0, text=name)
        # -----------------------------------------------------------------
        # Causal relation detection – simple grammar on a JSON‑stringified payload.
        # -----------------------------------------------------------------
        text_blob = json.dumps(payload)
        relations = extract_causal_relations_from_text(text_blob)
        for src_name, tgt_name in relations:
            src_id = graph.resolve_alias(src_name) or graph.get_entity_by_name(src_name)["id"]
            tgt_id = graph.resolve_alias(tgt_name) or graph.get_entity_by_name(tgt_name)["id"]
            if src_id and tgt_id:
                graph.upsert_edge(src_id=src_id, dst_id=tgt_id, relation="LEADS_TO", weight=1.0)
                new_edges += 1

    # -----------------------------------------------------------------
    # 3. Prune old/low‑importance memory
    # -----------------------------------------------------------------
    pruning_stats = prune_all()

    # Clean up DB connections
    graph.close()

    return {
        "processed_episodes": len(recent_episodes),
        "new_entities": len(new_entities),
        "new_edges": new_edges,
        "pruning": pruning_stats,
    }

# End of memory_engine.py
