import httpx
import os
from .datavault import write, append_and_verify
from .safeguard import audit
from .wasm_validator import validate_wasm_base64
from ..pipeline.permit import create_permit

TRUSTED_EXECUTOR_URL = os.environ.get("TRUSTED_EXECUTOR_URL", "http://trusted-executor:8040/execute")
SAFEGUARD_JWKS = os.environ.get('SAFEGUARD_JWKS', 'http://safeguard:8013/.well-known/jwks.json')
DATAVAULT_JWKS = os.environ.get('DATAVAULT_JWKS', 'http://datavault:8012/.well-known/jwks.json')
ORCH_JWKS = os.environ.get('ORCH_JWKS', 'http://orchestrator:8020/.well-known/jwks.json')

# JWKS discovery is handled at orchestrator startup and stored on app.state if needed


async def safe_execute_wasm(wasm_b64: str, agent_id: str, metadata: dict | None = None, timeout: int = 30):
	payload_meta = metadata or {}
	# include wasm size in metadata for audit
	try:
		wasm_size = len(wasm_b64.encode('utf-8'))
	except Exception:
		wasm_size = 0
	payload_meta["wasm_b64_size"] = wasm_size

	# validate wasm
	try:
		meta = validate_wasm_base64(wasm_b64)
	except Exception:
		meta = {"valid": False}
	payload_meta.update({"wasm_validator": meta})

	if not meta.get("valid"):
		dv = await write('orchestrator', {'event': 'wasm_validation_failed', 'agent_id': agent_id, 'meta': meta})
		return {"ok": False, "reason": "wasm_invalid", "meta": meta, "datavault": dv}

	# Ask SafeGuard for permission
	sg = await audit(agent_id, "execute_wasm", payload_meta)
	if sg.get("decision") != "allow":
		dv = await write('orchestrator', {'event': 'wasm_execution_denied', 'agent_id': agent_id, 'audit': sg})
		return {"ok": False, "reason": "safeguard_denied", "audit": sg, "datavault": dv}

	# record request in datavault
	req_log = await append_and_verify('orchestrator', {'event': 'wasm_execution_request', 'agent_id': agent_id, 'meta': payload_meta})
	if not req_log.get('ok'):
		return {"ok": False, "reason": "datavault_receipt_required", "datavault": req_log}

	# create ExecutionPermit and pass to trusted-executor
	try:
		decision_token = sg.get('decision_token')
	except Exception:
		decision_token = None

	permit = create_permit(decision_token, req_log.get('audit_receipt'), ttl_seconds=60)

	# call trusted-executor with permit
	try:
		async with httpx.AsyncClient() as client:
			r = await client.post(TRUSTED_EXECUTOR_URL, json={"lang": "wasm", "code": wasm_b64, "timeout": timeout, "permit": permit}, timeout=timeout + 5.0)
		try:
			res = r.json()
		except Exception:
			res = {"ok": False, "error": "trusted_executor_response_parse_error", "text": r.text}
	except Exception as e:
		res = {"ok": False, "error": str(e)}

	# log result
	res_log = await write('orchestrator', {'event': 'wasm_execution_result', 'agent_id': agent_id, 'request_log': req_log, 'result': res})

	return {"ok": True, "request_log": req_log, "result": res, "result_log": res_log, "audit": sg}
