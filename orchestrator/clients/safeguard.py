import httpx
import os

SAFEGUARD_URL = os.environ.get("SAFEGUARD_URL", "http://safeguard:8013/audit")
# Orchestrator will fetch JWKS from services at startup; services expose JWKS endpoints.


async def audit(agent_id: str, action: str, metadata: dict | None = None):
	payload = {"agent_id": agent_id, "action": action, "metadata": metadata}
	try:
		async with httpx.AsyncClient() as client:
			r = await client.post(SAFEGUARD_URL, json=payload, timeout=5.0)
		try:
			return r.json()
		except Exception:
			return {"decision": "deny", "reason": "safeguard_parse_error", "datavault": {"entry_hash": None}}
	except Exception as e:
		return {"decision": "deny", "reason": "safeguard_unreachable"}
