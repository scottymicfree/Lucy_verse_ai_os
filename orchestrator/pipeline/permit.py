import os
import json
import time
import hmac
import hashlib
from nacl.signing import SigningKey
import uuid

ORCH_PERMIT_KEY = os.environ.get('ORCH_PERMIT_KEY', 'dev-orch-key')
ORCH_PRIV_KEY = os.environ.get('ORCH_PRIV_KEY')
ORCH_SIGNING_KEY = None
if ORCH_PRIV_KEY:
	try:
		ORCH_SIGNING_KEY = SigningKey(bytes.fromhex(ORCH_PRIV_KEY))
	except Exception:
		ORCH_SIGNING_KEY = None
ORCH_KID = os.environ.get('ORCH_KID', f"orch-{os.environ.get('KEY_ID','2026-06')}")


def canonical_json(obj: dict) -> bytes:
	return json.dumps(obj, separators=(',', ':'), sort_keys=True).encode()


def create_permit(decision_token: dict, audit_receipt: dict, ttl_seconds: int = 60, nonce: str | None = None) -> dict:
	if nonce is None:
		nonce = uuid.uuid4().hex
	expires_at = int(time.time()) + int(ttl_seconds)
	payload = {
		'decision_token': decision_token,
		'audit_receipt': audit_receipt,
		'nonce': nonce,
		'ttl': expires_at,
	}
	canon = canonical_json(payload)
	ORCH_KID = os.environ.get('ORCH_KID', f"orch-{os.environ.get('KEY_ID','2026-06')}")
	if ORCH_SIGNING_KEY:
		signature = ORCH_SIGNING_KEY.sign(canon).signature.hex()
		permit = {'payload': payload, 'signature': signature, 'signer': 'orchestrator', 'kid': ORCH_KID, 'alg': 'Ed25519'}
	else:
		signature = hmac.new(ORCH_PERMIT_KEY.encode(), canon, hashlib.sha256).hexdigest()
		permit = {'payload': payload, 'signature': signature, 'signer': 'orchestrator'}
	return permit
