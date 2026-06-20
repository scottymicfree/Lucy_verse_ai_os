import re
import json
from typing import List, Dict, Any, Tuple

# Simple heuristic entity extractor – operates on raw payload dicts.
# It looks for keys and capitalized words in string values.

# Normalization utilities
def _normalize(name: str) -> str:
    """Normalize entity name: lower‑case, strip surrounding punctuation, collapse spaces."""
    return re.sub(r"\s+", " ", name.strip().lower())

def _extract_from_string(text: str) -> List[str]:
    # Find capitalized words (simple heuristic)
    words = re.findall(r"\b[A-Z][a-zA-Z0-9_]+\b", text)
    return list(set(words))

def _detect_causal_relations(text: str) -> List[Tuple[str, str]]:
    """Detect simple causal language like "X leads to Y" or "X causes Y".
    Returns list of (source, target) pairs.
    """
    patterns = [
        r"(?P<src>\w+)\s+leads? to\s+(?P<tgt>\w+)",
        r"(?P<src>\w+)\s+causes?\s+(?P<tgt>\w+)",
        r"(?P<src>\w+)\s+results? in\s+(?P<tgt>\w+)"
    ]
    relations = []
    for pat in patterns:
        for m in re.finditer(pat, text, flags=re.IGNORECASE):
            src = _normalize(m.group('src'))
            tgt = _normalize(m.group('tgt'))
            if src and tgt:
                relations.append((src, tgt))
    return relations

def _extract_entities_from_payload(payload: Dict[str, Any]) -> List[Dict[str, str]]:
    """Core extractor for generic JSON payloads.
    Returns list of dicts with ``name`` and ``type`` ("key" or "text").
    """
    entities: List[Dict[str, str]] = []
    # Keys become 'key' entities
    for key in payload.keys():
        entities.append({"name": _normalize(str(key)), "type": "key"})
    # Values – strings & nested structures
    for value in payload.values():
        if isinstance(value, str):
            for name in _extract_from_string(value):
                entities.append({"name": _normalize(name), "type": "text"})
        elif isinstance(value, (list, dict)):
            sub = value if isinstance(value, dict) else {str(i): v for i, v in enumerate(value)}
            entities.extend(_extract_entities_from_payload(sub))
    return entities

def extract_entities(payload: Dict[str, Any]) -> List[Dict[str, str]]:
    """Public API – extracts entities from a generic payload.
    Dedupe by normalized name.
    """
    raw = _extract_entities_from_payload(payload)
    # Deduplicate
    seen = set()
    uniq: List[Dict[str, str]] = []
    for ent in raw:
        if ent["name"] not in seen:
            seen.add(ent["name"])
            uniq.append(ent)
    return uniq

# ---------------------------------------------------------------------------
# Specialized extraction helpers for Lucy's memory tables / persona text
# ---------------------------------------------------------------------------

def extract_entities_from_incident(row: Dict[str, Any]) -> List[Dict[str, str]]:
    """Extract entities from an ``incident_memory`` row.
    Expected keys: ``component``, ``details``.
    """
    payload = {"component": row.get("component"), "details": row.get("details", "")}
    return extract_entities(payload)

def extract_entities_from_security(row: Dict[str, Any]) -> List[Dict[str, str]]:
    """Extract entities from a ``security_memory`` row.
    Expected keys: ``source``, ``event_type``, ``payload``.
    """
    payload = {
        "source": row.get("source"),
        "event_type": row.get("event_type"),
        "payload": row.get("payload", "")
    }
    return extract_entities(payload)

def extract_entities_from_persona(text: str) -> List[Dict[str, str]]:
    """Extract entities from the persona block (plain text).
    Treat each capitalized word as a potential entity.
    """
    names = _extract_from_string(text)
    uniq = []
    seen = set()
    for n in names:
        norm = _normalize(n)
        if norm not in seen:
            seen.add(norm)
            uniq.append({"name": norm, "type": "persona"})
    return uniq

def extract_causal_relations_from_text(text: str) -> List[Tuple[str, str]]:
    """Public helper that returns (source, target) pairs for causal language.
    Used by the graph engine to create ``LEADS_TO`` edges.
    """
    return _detect_causal_relations(text)
