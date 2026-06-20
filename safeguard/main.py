from fastapi import FastAPI
from pydantic import BaseModel
from typing import Any, Dict, List
import requests
import os
import time
import json
import hmac
import hashlib
# pyrefly: ignore [missing-import]
from nacl.signing import SigningKey
# pyrefly: ignore [missing-import]
from nacl.encoding import HexEncoder

app = FastAPI()
DATAVAULT_URL = os.environ.get("DATAVAULT_URL", "http://datavault:8012/log")
DATAVAULT_ENTRIES = os.environ.get("DATAVAULT_ENTRIES", "http://datavault:8012/entries")
SAFEGUARD_HMAC_KEY = os.environ.get("SAFEGUARD_HMAC_KEY", "dev-sg-key")
SAFEGUARD_PRIV_KEY = os.environ.get("SAFEGUARD_PRIV_KEY")
SAFEGUARD_PUB_KEY = os.environ.get("SAFEGUARD_PUB_KEY")
SAFEGUARD_KID = os.environ.get("SAFEGUARD_KID", f"sg-{os.environ.get('KEY_ID','2026-06')}")

# load SigningKey if provided (hex encoded)
SG_SIGNING_KEY = None
if SAFEGUARD_PRIV_KEY:
	try:
		SG_SIGNING_KEY = SigningKey(bytes.fromhex(SAFEGUARD_PRIV_KEY))
	except Exception:
		# ignore and fallback to HMAC
		SG_SIGNING_KEY = None


class IntentPayload(BaseModel):
	agent_id: str
	action: str
	metadata: Dict[str, Any] | None = None


# default weighted rules (must sum to 1)
RULE_WEIGHTS = {
	"syntax_safe": 0.25,
	"size_limit": 0.25,
	"perf_stability": 0.25,
	"dangerous_imports": 0.25,
}

# baseline threshold and scaling for perf derivative
THETA_0 = float(os.environ.get("SAFEGUARD_THETA0", "0.6"))
GAMMA = float(os.environ.get("SAFEGUARD_GAMMA", "0.4"))


def fetch_perf_entries(limit: int = 20) -> List[Dict[str, Any]]:
	try:
		r = requests.get(f"{DATAVAULT_ENTRIES}?source=perfmon&limit={limit}", timeout=3)
		r.raise_for_status()
		data = r.json()
		return data.get("entries", [])
	except Exception:
		return []


def compute_perf_derivative(entries: List[Dict[str, Any]]) -> float:
	# compute simple derivative of (cpu+mem)/2 per second, normalized
	samples = []
	for e in reversed(entries):
		rec = e.get("record") or {}
		payload = rec.get("payload") or {}
		ts = rec.get("timestamp")
		cpu = payload.get("cpu")
		mem = payload.get("mem")
		if ts is None or cpu is None or mem is None:
			continue
		samples.append((ts, float(cpu), float(mem)))
	if len(samples) < 2:
		return 0.0
	# compute average metric over time
	times = [s[0] for s in samples]
	metrics = [ (s[1] + s[2]) / 200.0 for s in samples ]  # normalize percent to 0..1
	dt = times[-1] - times[0]
	if dt <= 0:
		return 0.0
	derivative = (metrics[-1] - metrics[0]) / dt
	# clamp
	return max(0.0, derivative)


def rule_syntax_safe(action: str, metadata: Dict[str, Any] | None) -> float:
	a = (action or "").lower()
	if "danger" in a or "rm -rf" in a or "format" in a:
		return 0.0
	return 1.0


def rule_size_limit(action: str, metadata: Dict[str, Any] | None) -> float:
	size = len(action or "")
	# if code present in metadata, measure that too
	if metadata and isinstance(metadata.get("code"), str):
		size += len(metadata.get("code"))
	# normalize: 0..10000 chars -> score
	score = max(0.0, 1.0 - (size / 10000.0))
	return score


import ast

GLOBAL_ALLOWLIST = {
	"math", "statistics", "json", "dataclasses", "typing", "functools", "itertools", "collections", "decimal", "fractions",
	"hashlib", "hmac", "base64", "re"
}

BLOCKED_MODULES = {
	"os", "sys", "subprocess", "socket", "requests", "http.client", "pathlib", "shutil", "ctypes", "multiprocessing", "threading", "importlib"
}

BLOCKED_FUNCTIONS = {
	"eval", "exec", "open", "getattr", "setattr", "delattr", "hasattr", "__import__"
}

class SafeASTVisitor(ast.NodeVisitor):
	def __init__(self):
		self.safe = True
		self.reason = ""

	def visit_Import(self, node):
		for name in node.names:
			base_module = name.name.split('.')[0]
			if base_module not in GLOBAL_ALLOWLIST:
				self.safe = False
				self.reason = f"Import of module '{name.name}' is not allowed."
				return
		self.generic_visit(node)

	def visit_ImportFrom(self, node):
		if not node.module:
			self.safe = False
			self.reason = "Relative imports are not allowed."
			return
		base_module = node.module.split('.')[0]
		if base_module not in GLOBAL_ALLOWLIST:
			self.safe = False
			self.reason = f"Import from module '{node.module}' is not allowed."
			return
		self.generic_visit(node)

	def visit_Call(self, node):
		if isinstance(node.func, ast.Name):
			if node.func.id in BLOCKED_FUNCTIONS:
				self.safe = False
				self.reason = f"Call to blocked function '{node.func.id}' is not allowed."
				return
		elif isinstance(node.func, ast.Attribute):
			if node.func.attr in BLOCKED_FUNCTIONS:
				self.safe = False
				self.reason = f"Call to blocked attribute '{node.func.attr}' is not allowed."
				return
		self.generic_visit(node)

	def visit_Attribute(self, node):
		if node.attr in BLOCKED_FUNCTIONS or node.attr in BLOCKED_MODULES:
			self.safe = False
			self.reason = f"Accessing attribute '{node.attr}' is blocked."
			return
		self.generic_visit(node)

	def visit_Name(self, node):
		if node.id in BLOCKED_FUNCTIONS or node.id in BLOCKED_MODULES:
			self.safe = False
			self.reason = f"Reference to '{node.id}' is blocked."
			return
		self.generic_visit(node)


def rule_dangerous_imports(action: str, metadata: Dict[str, Any] | None) -> float:
	code = "" if not metadata else metadata.get("code", "")
	if not code:
		return 1.0
	try:
		tree = ast.parse(code)
	except SyntaxError:
		return 0.0

	visitor = SafeASTVisitor()
	visitor.visit(tree)
	if not visitor.safe:
		return 0.0
	return 1.0


def rule_perf_stability(action: str, metadata: Dict[str, Any] | None) -> float:
	entries = fetch_perf_entries(limit=20)
	deriv = compute_perf_derivative(entries)
	# higher derivative -> lower score
	# map derivative to score between 0 and 1 (assume derivative typical small values)
	score = max(0.0, 1.0 - deriv * 10.0)
	return score


RULE_FUNCS = {
	"syntax_safe": rule_syntax_safe,
	"size_limit": rule_size_limit,
	"perf_stability": rule_perf_stability,
	"dangerous_imports": rule_dangerous_imports,
}


def rule_wasm_module_checks(action: str, metadata: Dict[str, Any] | None) -> float:
	# metadata expected to contain wasm_validator info
	if not metadata:
		return 0.0
	meta = metadata.get('wasm_validator') or {}
	if not meta.get('valid'):
		return 0.0
	# enforce size limit (e.g., 1MB)
	size = meta.get('size', 0)
	if size > 1_000_000:
		return 0.0
	# require at least one export
	exports = meta.get('exports', 0)
	if exports < 1:
		return 0.0
	# simple pass
	return 1.0


# add wasm rule
RULE_FUNCS['wasm_module_checks'] = rule_wasm_module_checks
RULE_WEIGHTS['wasm_module_checks'] = 0.2
# normalize existing weights to keep sum reasonable
for k in RULE_WEIGHTS:
	RULE_WEIGHTS[k] = RULE_WEIGHTS[k]


def compute_scores(action: str, metadata: Dict[str, Any] | None) -> Dict[str, float]:
	scores = {}
	for name, func in RULE_FUNCS.items():
		try:
			scores[name] = float(func(action, metadata))
		except Exception:
			scores[name] = 0.0
	return scores


def compute_S(scores: Dict[str, float], weights: Dict[str, float]) -> float:
	# ensure weights normalized
	total_w = sum(weights.values())
	if total_w <= 0:
		return 0.0
	S = 0.0
	for k, v in weights.items():
		w = v / total_w
		S += w * scores.get(k, 0.0)
	return S


def compute_hmac(data: bytes) -> str:
	return hmac.new(SAFEGUARD_HMAC_KEY.encode(), data, hashlib.sha256).hexdigest()


def compute_signature_ed25519(data: bytes) -> str:
	if SG_SIGNING_KEY:
		sig = SG_SIGNING_KEY.sign(data).signature
		return sig.hex()
	return compute_hmac(data)

# no-op refresh helper to change file content for test context refresh
def _refresh_noop() -> None:
	# intentionally does nothing; kept for test environment reloads
	return None


@app.post("/audit")
async def audit_intent(payload: IntentPayload):
	action = payload.action
	metadata = payload.metadata or {}
	# compute per-rule scores
	scores = compute_scores(action, metadata)
	S = compute_S(scores, RULE_WEIGHTS)
	# compute dynamic threshold
	perf_entries = fetch_perf_entries(limit=20)
	deriv = compute_perf_derivative(perf_entries)
	theta = THETA_0 + GAMMA * deriv
	decision = "allow" if S >= theta else "deny"
	reason = "" if decision == "allow" else f"S({S:.3f}) < theta({theta:.3f})"

	# write decision to datavault
	dv_payload = {"agent_id": payload.agent_id, "action": action, "decision": decision, "reason": reason, "scores": scores, "S": S, "theta": theta}
	try:
		r = requests.post(DATAVAULT_URL, json={"source": "safeguard", "payload": dv_payload}, timeout=3)
		try:
			dv = r.json()
		except Exception:
			dv = {"ok": True, "entry_hash": None}
	except Exception:
		dv = {"ok": False, "reason": "datavault_unreachable"}

	# create a signed decision token (Audit DecisionToken)
	token_payload = {
		"agent_id": payload.agent_id,
		"action": action,
		"decision": decision,
		"scores": scores,
		"S": S,
		"theta": theta,
		"timestamp": time.time(),
	}
	# canonical JSON
	token_json = json.dumps(token_payload, separators=(",", ":"), sort_keys=True)
	signature = compute_signature_ed25519(token_json.encode())
	alg = "Ed25519" if SG_SIGNING_KEY else "HMAC-SHA256"
	decision_token = {"token": token_payload, "signature": signature, "kid": SAFEGUARD_KID, "alg": alg}

	return {"decision": decision, "reason": reason, "scores": scores, "S": S, "theta": theta, "datavault": dv, "decision_token": decision_token}


@app.get("/rules")
async def get_rules():
	return {"weights": RULE_WEIGHTS}


@app.get('/.well-known/jwks.json')
async def jwks():
	# serve a simple JWKS if public key provided via env (base64url in x)
	pub = os.environ.get('SAFEGUARD_PUB_KEY')
	kid = os.environ.get('SAFEGUARD_KID', f"sg-{os.environ.get('KEY_ID','2026-06')}")
	if not pub:
		return {"keys": []}
	import base64
	x = base64.urlsafe_b64encode(bytes.fromhex(pub)).rstrip(b"=").decode()
	return {"keys": [{"kid": kid, "kty": "OKP", "crv": "Ed25519", "x": x}]}


@app.post("/rules/set")
async def set_rules(weights: Dict[str, float]):
	# update in-memory weights
	for k, v in weights.items():
		if k in RULE_WEIGHTS:
			try:
				RULE_WEIGHTS[k] = float(v)
			except Exception:
				pass
	return {"ok": True, "weights": RULE_WEIGHTS}


@app.get('/health')
async def health():
	return {"status": "ok", "service": "safeguard"}


if __name__ == '__main__':
	import uvicorn
	uvicorn.run(app, host="0.0.0.0", port=8013)
