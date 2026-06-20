import os
import httpx
import json


SAFEGUARD_URL = os.environ.get('SAFEGUARD_URL', 'http://safeguard:8013/audit')


def verify_signature(token: dict, app=None) -> bool:
	# prefer kid-based JWKS verification; fallback to HMAC when no kid
	sig = token.get('signature')
	payload = token.get('token')
	kid = token.get('kid')
	if not sig or not payload:
		return False
	canonical = json.dumps(payload, separators=(',', ':'), sort_keys=True).encode()
	# try JWKS via configured SAFEGAURD_JWKS
	if kid:
		try:
			# try orchestrator-cached client first if available
			clients = []
			from ..clients.safeguard import _get_sg_jwks
			jwks_client = _get_sg_jwks()
			if jwks_client:
				clients.append(jwks_client)
			# if app provided, try its cached client
			if app and getattr(app, 'state', None):
				ac = getattr(app.state, 'safeguard_jwks', None)
				if ac:
					clients.append(ac)
			from ...trust_registry.client import verify_with_jwks
			if verify_with_jwks(sig, canonical, kid, clients):
				return True
		except Exception:
			pass
	# fallback hmac
	import hmac, hashlib
	key = os.environ.get('SAFEGUARD_HMAC_KEY', 'dev-sg-key')
	expected = hmac.new(key.encode(), canonical, hashlib.sha256).hexdigest()
	return hmac.compare_digest(expected, sig)


async def verify_safeguard_decision(agent_id: str, action: str, metadata: dict | None = None) -> dict:
	# call safeguard service to obtain decision and decision_token, verify signature
	try:
		async with httpx.AsyncClient() as client:
			r = await client.post(SAFEGUARD_URL, json={"agent_id": agent_id, "action": action, "metadata": metadata}, timeout=5.0)
			data = r.json()
	except Exception as e:
		return {"ok": False, "reason": "safeguard_unreachable", "error": str(e)}

	# expect decision_token in response
	token = data.get('decision_token')
	if not token:
		return {"ok": False, "reason": "no_decision_token", "safeguard": data}

	if not verify_signature(token, app=None):
		return {"ok": False, "reason": "invalid_token_signature", "safeguard": data}

	decision = data.get('decision')
	if decision != 'allow':
		return {"ok": False, "reason": "deny", "safeguard": data}

	return {"ok": True, "decision_token": token}
