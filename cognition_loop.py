# src/cognition_loop.py

import os
from memory.memory_engine import tick as memory_tick, should_tick
from memory.episodic import EpisodicMemory
from memory.retrieval import RetrievalEngine

# Retrieval configuration
RETRIEVAL_TOP_K = int(os.getenv("RETRIEVAL_TOP_K", "5"))
# Single shared retrieval engine instance
_retrieval_engine = RetrievalEngine()

def _format_memory_context(items):
    """Format retrieved items into a bullet‑list string for prompt injection."""
    if not items:
        return "(no relevant memory)"
    lines = []
    for i, item in enumerate(items, start=1):
        # Show a concise representation depending on source type
        src = item.get("source", "")
        kind = item.get("kind", "")
        identifier = item.get("identifier", "")
        lines.append(f"{i}. [{src}] {kind}:{identifier}")
    return "\n".join(lines)

def run_cognition_loop(event: dict) -> dict:
    """
    Cognition loop with Memory Battalion activation and memory‑driven context.

    Steps:
    1. Build prompt with injected memory context
    2. Call LLM (placeholder)
    3. Persist episode
    4. Activate Memory Battalion via tick (conditionally)
    5. Return response
    """

    # 1. Build a prompt (naïve for now)
    user_prompt = event.get("prompt", "")
    # Retrieve up to RETRIEVAL_TOP_K relevant items
    retrieved = _retrieval_engine.fused_search(user_prompt, top_k=RETRIEVAL_TOP_K)
    memory_section = _format_memory_context(retrieved)
    # Structured prompt sections
    prompt = f"[MEMORY CONTEXT]\n{memory_section}\n\n[USER INPUT]\n{user_prompt}"

    # 2. Call the LLM – placeholder echo (could be replaced later)
    response = {"content": f"Echo: {user_prompt}"}

    # 3. Persist the episode
    episodic = EpisodicMemory()
    episodic.store_event(event, response)

    # 4. Memory Battalion activation (safe, non‑blocking) – only on tick interval
    if should_tick():
        try:
            summary = memory_tick()
            # Optional logging could be added here
        except Exception:
            # Memory failures must never break cognition
            pass

    # 5. Return the response back to the UI / caller
    return response
