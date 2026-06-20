import time
import json
import threading
import httpx
from typing import Dict, Optional
import base64
from nacl.signing import VerifyKey


class JWKSClient:
	def __init__(self, url: str, refresh_interval: int = 60):
		self.url = url
		self.refresh_interval = refresh_interval
		self._keys: Dict[str, VerifyKey] = {}
		self._raw = {}
		self._lock = threading.Lock()
		self._last = 0
		# initial fetch
		try:
			self.refresh()
		except Exception:
			pass

	def refresh(self):
		r = httpx.get(self.url, timeout=5.0)
		r.raise_for_status()
		data = r.json()
		keys = data.get('keys', [])
		nk = {}
		for k in keys:
			kid = k.get('kid')
			x = k.get('x')
			if not kid or not x:
				continue
			# base64url -> bytes
			mod = x + '=='
			bb = base64.urlsafe_b64decode(mod)
			try:
				vk = VerifyKey(bb)
				nk[kid] = vk
			except Exception:
				continue
		with self._lock:
			self._keys = nk
			self._raw = data
			self._last = time.time()

	def get(self, kid: str) -> Optional[VerifyKey]:
		with self._lock:
			vk = self._keys.get(kid)
		# refresh if stale
		if not vk and time.time() - self._last > self.refresh_interval:
			try:
				self.refresh()
			except Exception:
				pass
			with self._lock:
				vk = self._keys.get(kid)
		return vk


def verify_with_jwks(obj_sig_hex: str, payload_canon: bytes, kid: str, jwks_clients: list["JWKSClient"] | None = None) -> bool:
	"""Attempt to verify a signature (hex) over payload_canon using kid across provided jwks_clients.
	jwks_clients: list of JWKSClient to try; if None, caller should rely on service-specific clients.
	Returns True if verification succeeds.
	"""
	if not kid or not obj_sig_hex or not payload_canon:
		return False
	sig_bytes = None
	try:
		sig_bytes = bytes.fromhex(obj_sig_hex)
	except Exception:
		return False
	# try provided clients
	if jwks_clients:
		for c in jwks_clients:
			try:
				vk = c.get(kid)
				if vk:
					vk.verify(payload_canon, sig_bytes)
					return True
			except Exception:
				continue
	return False
