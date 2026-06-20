import httpx
import os

TE_V2_URL = os.environ.get('TE_V2_URL', 'http://trusted-executor-v2:8050/execute_multimodal')


async def send_multimodal(permit: dict, payload: dict, timeout: int = 120):
	try:
		async with httpx.AsyncClient() as client:
			r = await client.post(TE_V2_URL, json={"permit": permit, "payload": payload}, timeout=float(timeout))
		try:
			return r.json()
		except Exception:
			return {"ok": False, "error": "parse_error", "text": r.text}
	except Exception as e:
		return {"ok": False, "error": str(e)}
