import httpx
import os
import json
import hmac
import hashlib
from nacl.signing import VerifyKey

DATAVAULT_URL = os.environ.get("DATAVAULT_URL", "http://datavault:8012/log")
DATAVAULT_SIGNING_KEY = os.environ.get("DATAVAULT_SIGNING_KEY", "dev-dv-key")
DATAVAULT_PUB_KEY = os.environ.get("DATAVAULT_PUB_KEY")
DV_VERIFY_KEY = None
if DATAVAULT_PUB_KEY:
	try:
		DV_VERIFY_KEY = VerifyKey(bytes.fromhex(DATAVAULT_PUB_KEY))
	except Exception:
		DV_VERIFY_KEY = None

async def write(source: str, payload: dict):
	try:
		async with httpx.AsyncClient() as client:
			r = await client.post(DATAVAULT_URL, json={"source": source, "payload": payload}, timeout=5.0)
		try:
			return r.json()
		except Exception:
			return {"ok": True, "entry_hash": None}
	except Exception as e:
		return {"ok": False, "reason": str(e)}


async def append_log(source: str, payload: dict):
	# convenience alias
	return await write(source, payload)


def verify_receipt(receipt: dict) -> bool:
	if not receipt or not isinstance(receipt, dict):
		return False
	sig = receipt.get('signature')
	payload = receipt.get('receipt')
	if not sig or not payload:
		return False
	canonical = json.dumps(payload, separators=(',', ':'), sort_keys=True).encode()
	# try ed25519 verify if public key available
	if DV_VERIFY_KEY:
		try:
			DV_VERIFY_KEY.verify(canonical, bytes.fromhex(sig))
			return True
		except Exception:
			return False
	expected = hmac.new(DATAVAULT_SIGNING_KEY.encode(), canonical, hashlib.sha256).hexdigest()
	return hmac.compare_digest(expected, sig)


async def append_and_verify(source: str, payload: dict, timeout: int = 5):
	try:
		async with httpx.AsyncClient() as client:
			r = await client.post(DATAVAULT_URL, json={"source": source, "payload": payload}, timeout=timeout)
			r.raise_for_status()
			data = r.json()
	except Exception as e:
		return {"ok": False, "reason": "datavault_unreachable", "error": str(e)}

	receipt = data.get('audit_receipt')
	if not receipt:
		return {"ok": False, "reason": "no_audit_receipt", "response": data}

	if not verify_receipt(receipt):
		return {"ok": False, "reason": "invalid_receipt_signature", "receipt": receipt}

	return {"ok": True, "entry_hash": data.get('entry_hash'), "audit_receipt": receipt}


async def safe_write_with_cb(cb, source: str, payload: dict):
	"""Attempt to write using a circuit breaker or fallback to local noop."""
	async def _fallback(e):
		return {"ok": False, "reason": str(e)}
	try:
		return await cb.call(lambda: write(source, payload), fallback=_fallback)
	except Exception as e:
		return {"ok": False, "reason": str(e)}
