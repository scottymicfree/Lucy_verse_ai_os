import subprocess
import shlex
import time
from typing import Dict


def _run(cmd: str) -> Dict:
	try:
		p = subprocess.run(shlex.split(cmd), capture_output=True, text=True, check=False)
		return {"rc": p.returncode, "out": p.stdout, "err": p.stderr}
	except Exception as e:
		return {"rc": -1, "out": "", "err": str(e)}


def kill_service(service_name: str, compose_file: str = 'docker-compose.yml') -> Dict:
	# docker compose stop <service>
	cmd = f'docker compose -f {compose_file} stop {service_name}'
	return _run(cmd)


def start_service(service_name: str, compose_file: str = 'docker-compose.yml') -> Dict:
	cmd = f'docker compose -f {compose_file} start {service_name}'
	return _run(cmd)


def restart_service(service_name: str, compose_file: str = 'docker-compose.yml') -> Dict:
	res1 = kill_service(service_name, compose_file)
	time.sleep(1)
	res2 = start_service(service_name, compose_file)
	return {"stop": res1, "start": res2}


def inject_latency(service_name: str, ms: int = 100):
	# For local compose, we cannot easily inject latency without external tools.
	# This is a placeholder that records intent.
	return {"ok": True, "note": f"Requested {ms}ms latency against {service_name} (not implemented)."}
