from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import subprocess
import os
import tempfile
import uuid
import json
import base64
import shutil
import httpx
import time
import hmac
import hashlib
from nacl.signing import VerifyKey

# nonce store: prefer redis if REDIS_URL set, else fallback to in-memory set
NONCE_CACHE = set()
REDIS_URL = os.environ.get('REDIS_URL')
_redis = None
if REDIS_URL:
	try:
		import redis as _redis_lib
		_redis = _redis_lib.from_url(REDIS_URL, decode_responses=True)
	except Exception:
		_redis = None
ORCH_PERMIT_KEY = os.environ.get('ORCH_PERMIT_KEY', 'dev-orch-key')
ORCH_PUB_KEY = os.environ.get('ORCH_PUB_KEY')
ORCH_VERIFY_KEY = None
if ORCH_PUB_KEY:
	try:
		ORCH_VERIFY_KEY = VerifyKey(bytes.fromhex(ORCH_PUB_KEY))
	except Exception:
		ORCH_VERIFY_KEY = None

SAFETY_LOGGER = logging.getLogger('trusted_executor')

# Load mandatory JWKS / key env vars without fallbacks
SAFEGUARD_HMAC_KEY = os.getenv('SAFEGUARD_HMAC_KEY')  # No default – must be set if JWKS unavailable
DATAVAULT_SIGNING_KEY = os.getenv('DATAVAULT_SIGNING_KEY')  # No default – must be set if JWKS unavailable
DATAVAULT_PUB_KEY = os.environ.get('DATAVAULT_PUB_KEY')
DV_VERIFY_KEY = None
if DATAVAULT_PUB_KEY:
	try:
		DV_VERIFY_KEY = VerifyKey(bytes.fromhex(DATAVAULT_PUB_KEY))
	except Exception:
		DV_VERIFY_KEY = None

app = FastAPI()

TE_PRIV_KEY = os.environ.get('TE_PRIV_KEY')
TE_PUB_KEY = os.environ.get('TE_PUB_KEY')
TE_KID = os.environ.get('TE_KID', f"te-{os.environ.get('KEY_ID','2026-06')}")
TE_SIGNING_KEY = None
if TE_PRIV_KEY:
	try:
		from nacl.signing import SigningKey
		TE_SIGNING_KEY = SigningKey(bytes.fromhex(TE_PRIV_KEY))
	except Exception:
		TE_SIGNING_KEY = None


@app.on_event('startup')
async def te_startup():
	# attempt to prefetch jwks for services if configured
	try:
		from . import __name__ as _pkg
		from ..trust_registry.client import JWKSClient
	except Exception:
		JWKSClient = None
	try:
		if JWKSClient:
			app.state.orch_jwks = JWKSClient(os.environ.get('ORCH_JWKS', 'http://orchestrator:8020/.well-known/jwks.json'))
			app.state.sg_jwks = JWKSClient(os.environ.get('SAFEGUARD_JWKS', 'http://safeguard:8013/.well-known/jwks.json'))
			app.state.dv_jwks = JWKSClient(os.environ.get('DATAVAULT_JWKS', 'http://datavault:8012/.well-known/jwks.json'))
	except Exception:
		pass

# runtime capability check
import shutil, logging
HAS_WASMTIME = shutil.which('wasmtime') is not None
if not HAS_WASMTIME:
	logging.getLogger('trusted_executor').warning('wasmtime not available in container; execution will be unavailable or limited')


class ExecReq(BaseModel):
	# lang can be 'wasm' or 'python' (python support kept for compatibility)
	lang: str
	# For wasm, provide base64-encoded wasm bytes in 'code' field
	code: str
	timeout: int = 5
	memory_mb: int | None = None
	permit: dict | None = None


DATAVAULT_URL = os.environ.get("DATAVAULT_URL", "http://datavault:8012/log")


def log_to_datavault(payload: dict):
	r = httpx.post(DATAVAULT_URL, json={"source": "trusted-executor", "payload": payload}, timeout=3.0)
	r.raise_for_status()


@app.post('/execute')
async def execute(req: ExecReq):
	rid = uuid.uuid4().hex
	result = {"request_id": rid, "ok": False}

	# Require permit for any execution
	if not req.permit:
		raise HTTPException(status_code=403, detail="missing_execution_permit")

	# verify orchestrator signature on permit
	permit = req.permit
	sig = permit.get('signature')
	payload = permit.get('payload')
	if not sig or not payload:
		raise HTTPException(status_code=403, detail="invalid_permit_structure")

	canon = json.dumps(payload, separators=(',', ':'), sort_keys=True).encode()
	# prefer kid-based JWKS verification using cached clients on app.state
	kid = permit.get('kid')
	verified = False
	if kid:
		try:
			clients = []
			if getattr(app, 'state', None):
				ac = getattr(app.state, 'orch_jwks', None)
				if ac:
					clients.append(ac)
			from ..trust_registry.client import verify_with_jwks
			if verify_with_jwks(sig, canon, kid, clients):
				verified = True
		except Exception:
			verified = False
	if not verified:
		# fallback to env-provided VerifyKey
		if ORCH_VERIFY_KEY:
			try:
				ORCH_VERIFY_KEY.verify(canon, bytes.fromhex(sig))
				verified = True
			except Exception:
				verified = False
	if not verified:
		expected = hmac.new(ORCH_PERMIT_KEY.encode(), canon, hashlib.sha256).hexdigest()
		if not hmac.compare_digest(expected, sig):
			raise HTTPException(status_code=403, detail="invalid_permit_signature")

	# check ttl
	ttl = payload.get('ttl')
	if not ttl or int(time.time()) > int(ttl):
		raise HTTPException(status_code=403, detail="permit_expired")

	# check nonce replay
	nonce = payload.get('nonce')
	if not nonce:
		raise HTTPException(status_code=403, detail="permit_missing_nonce")
	if _redis:
		try:
			added = _redis.setnx(f"nonce:{nonce}", "1")
			if not added:
				raise HTTPException(status_code=403, detail="nonce_replay")
			# set reasonable TTL to avoid unbounded growth
			_redis.expire(f"nonce:{nonce}", 3600)
		except HTTPException:
			raise
		except Exception:
			# fall back to in-memory
			if nonce in NONCE_CACHE:
				raise HTTPException(status_code=403, detail="nonce_replay")
			NONCE_CACHE.add(nonce)
	else:
		if nonce in NONCE_CACHE:
			raise HTTPException(status_code=403, detail="nonce_replay")
		NONCE_CACHE.add(nonce)

	# verify embedded DecisionToken signature (SafeGuard HMAC)
	decision_token = payload.get('decision_token')
	if not decision_token:
		raise HTTPException(status_code=403, detail="missing_decision_token")
	dt_sig = decision_token.get('signature')
	dt_token = decision_token.get('token')
	if not dt_sig or not dt_token:
		raise HTTPException(status_code=403, detail="invalid_decision_token")
	dt_canon = json.dumps(dt_token, separators=(',', ':'), sort_keys=True).encode()
	# Decision token verification: prefer kid-based JWKS lookup
	dt_kid = decision_token.get('kid') if isinstance(decision_token, dict) else None
	dt_verified = False
	if dt_kid:
		try:
			clients = []
			if getattr(app, 'state', None):
				ac = getattr(app.state, 'sg_jwks', None)
				if ac:
					clients.append(ac)
			from ..trust_registry.client import verify_with_jwks
			if verify_with_jwks(dt_sig, dt_canon, dt_kid, clients):
				dt_verified = True
		except Exception:
			dt_verified = False
	if not dt_verified and SG_VERIFY_KEY:
		try:
			SG_VERIFY_KEY.verify(dt_canon, bytes.fromhex(dt_sig))
			dt_verified = True
		except Exception:
			dt_verified = False
	if not dt_verified:
		dt_expected = hmac.new(SAFEGUARD_HMAC_KEY.encode(), dt_canon, hashlib.sha256).hexdigest()
		if not hmac.compare_digest(dt_expected, dt_sig):
			raise HTTPException(status_code=403, detail="invalid_decision_token_signature")

	# verify embedded AuditReceipt signature (DataVault)
	audit_receipt = payload.get('audit_receipt')
	if not audit_receipt:
		raise HTTPException(status_code=403, detail="missing_audit_receipt")
	ar_sig = audit_receipt.get('signature')
	ar_payload = audit_receipt.get('receipt')
	if not ar_sig or not ar_payload:
		raise HTTPException(status_code=403, detail="invalid_audit_receipt")
	ar_canon = json.dumps(ar_payload, separators=(',', ':'), sort_keys=True).encode()
	ar_kid = audit_receipt.get('kid') if isinstance(audit_receipt, dict) else None
	ar_verified = False
	if ar_kid:
		try:
			clients = []
			if getattr(app, 'state', None):
				ac = getattr(app.state, 'dv_jwks', None)
				if ac:
					clients.append(ac)
			from ..trust_registry.client import verify_with_jwks
			if verify_with_jwks(ar_sig, ar_canon, ar_kid, clients):
				ar_verified = True
		except Exception:
			ar_verified = False
	if not ar_verified and DV_VERIFY_KEY:
		try:
			DV_VERIFY_KEY.verify(ar_canon, bytes.fromhex(ar_sig))
			ar_verified = True
		except Exception:
			ar_verified = False
	if not ar_verified:
		ar_expected = hmac.new(DATAVAULT_SIGNING_KEY.encode(), ar_canon, hashlib.sha256).hexdigest()
		if not hmac.compare_digest(ar_expected, ar_sig):
			raise HTTPException(status_code=403, detail="invalid_audit_receipt_signature")

	# WASM execution path (expects base64-encoded wasm bytes)
	if req.lang.lower() == 'wasm':
		try:
			wasm_bytes = base64.b64decode(req.code)
		except Exception as e:
			raise HTTPException(status_code=400, detail=f"invalid base64 wasm: {e}")

		fd, path = tempfile.mkstemp(suffix='.wasm')
		try:
			with os.fdopen(fd, 'wb') as f:
				f.write(wasm_bytes)

			# Use wasmtime CLI to execute wasm module. The container image should
			# provide a wasmtime binary. We do not execute Python code for untrusted modules.
			if shutil.which('wasmtime'):
				try:
					max_mem_bytes = (req.memory_mb or 50) * 1024 * 1024
					cmd = [
						"wasmtime",
						"run",
						"--fuel", "1000000",
						"--max-memory-size", str(max_mem_bytes),
						path
					]
					p = subprocess.run(cmd, capture_output=True, text=True, timeout=req.timeout)
					result.update({"ok": True, "exit_code": p.returncode, "stdout": p.stdout, "stderr": p.stderr})
				except subprocess.TimeoutExpired:
					result.update({"ok": False, "error": "timeout"})
			else:
				raise HTTPException(status_code=500, detail="wasmtime CLI not available in container")
		finally:
			try:
				os.remove(path)
			except Exception:
				pass

		# log to datavault (fail-closed)
		try:
			log_to_datavault({"request_id": rid, "lang": "wasm", "result": {k: v for k, v in result.items() if k != 'ok'}})
		except Exception as e:
			raise HTTPException(status_code=500, detail=f"DataVault logging failed: {e}. Execution aborted to prevent unlogged state mutations.")
		return result

	# Python path retained for compatibility but not recommended for untrusted code
	elif req.lang.lower() == 'python':
		raise HTTPException(status_code=400, detail="untrusted python execution is disabled; compile to wasm instead")

	else:
		raise HTTPException(status_code=400, detail="unsupported language; use 'wasm'")


@app.get('/health')
async def health():
	return {"status": "ok", "service": "trusted-executor"}


def compute_result_receipt(result_hash: str, permit_hash: str) -> dict:
	payload = {"result_hash": result_hash, "permit_hash": permit_hash, "timestamp": time.time()}
	canon = json.dumps(payload, separators=(',', ':'), sort_keys=True).encode()
	if TE_SIGNING_KEY:
		sig = TE_SIGNING_KEY.sign(canon).signature.hex()
		alg = 'Ed25519'
	else:
		sig = hmac.new(ORCH_PERMIT_KEY.encode(), canon, hashlib.sha256).hexdigest()
		alg = 'HMAC-SHA256'
	return {"payload": payload, "signature": sig, "kid": TE_KID, "alg": alg}


@app.get('/.well-known/jwks.json')
async def jwks():
	pub = TE_PUB_KEY
	kid = TE_KID
	if not pub:
		return {"keys": []}
	import base64
	x = base64.urlsafe_b64encode(bytes.fromhex(pub)).rstrip(b"=").decode()
	return {"keys": [{"kid": kid, "kty": "OKP", "crv": "Ed25519", "x": x}]}
