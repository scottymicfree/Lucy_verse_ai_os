import asyncio
import time
import httpx
from typing import Dict


async def run_selftest() -> Dict:
	"""Run a set of synthetic transactions against local services and return a report."""
	services = {
		"datavault": "http://datavault:8012/health",
		"safeguard": "http://safeguard:8013/health",
		"trusted_executor": "http://trusted-executor:8040/health",
	}
	results = {}
	async with httpx.AsyncClient(timeout=5.0) as client:
		for name, url in services.items():
			try:
				r = await client.get(url)
				results[name] = {"ok": r.status_code == 200, "status_code": r.status_code}
			except Exception as e:
				results[name] = {"ok": False, "error": str(e)}

	# simple score
	score = 100
	for r in results.values():
		if not r.get('ok'):
			score -= 30
	return {"timestamp": time.time(), "score": max(0, score), "results": results}


def run_selftest_sync():
	return asyncio.run(run_selftest())
