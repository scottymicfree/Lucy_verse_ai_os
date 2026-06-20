from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional
import logging
from logging.handlers import RotatingFileHandler
import os
import uuid
import json
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey, Ed25519PublicKey
from cryptography.hazmat.primitives import serialization
from cryptography.exceptions import InvalidSignature
import base64
import pathlib
import jwt
import time
import sys

# Simple local toolbelt API. Endpoints are stubs that log requested actions.
# Production integration should replace stubs with platform-safe implementations
# (pyautogui, music APIs, TE v2 bridge, etc.) and add authentication + governance.

# Allow overriding the log directory via env for tests and deployments
LOG_DIR = os.getenv('TOOLBELT_LOG_DIR') or os.path.join(os.path.dirname(__file__), "..", "logs")
os.makedirs(LOG_DIR, exist_ok=True)
logfile = os.path.join(LOG_DIR, "toolbelt_actions.log")
handler = RotatingFileHandler(logfile, maxBytes=5 * 1024 * 1024, backupCount=5)
handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
root = logging.getLogger()
root.setLevel(logging.INFO)
root.addHandler(handler)

# Feature flags / governance
from src.shared.config import load_env, read_consent

CFG = load_env()
FEATURE_OS_INTEGRATION = CFG.get('FEATURE_OS_INTEGRATION', False)


def _log_action(action: str, payload: dict, governance: str = "toolbelt") -> str:
	"""Log a structured action entry and return a DecisionToken.

	The DecisionToken is a simple UUID used to trace decisions/actions in logs.
	In production this should be replaced with a signed DecisionToken tied to a PKI.
	"""
	token = uuid.uuid4().hex
	entry = {
		"decision_token": token,
		"action": action,
		"governance": governance,
		"payload": payload,
	}
	# Log as a single JSON string to make parsing easier for UIs
	logging.info(json.dumps(entry))
	# emit a lightweight presence event to UI via log (UI listens for patterns)
	try:
		# write a small presence line
		logging.info(json.dumps({"presence": action, "decision_token": token}))
	except Exception:
		pass
	return token


def _load_private_key():
	# Load dev private key if present; in production, key should be injected via environment/volume
	key_dir = os.path.join(os.path.dirname(__file__), 'keys')
	os.makedirs(key_dir, exist_ok=True)
	key_path = os.getenv('TOOLBELT_PRIV_KEY') or os.path.join(key_dir, 'dev_ed25519_private.pem')
	pub_path = os.getenv('TOOLBELT_PUB_RAW') or os.path.join(key_dir, 'dev_ed25519_public.raw')
	# Auto-generate dev keys if missing
	if not os.path.exists(key_path) or not os.path.exists(pub_path):
		try:
			priv = Ed25519PrivateKey.generate()
			priv_pem = priv.private_bytes(
				encoding=serialization.Encoding.PEM,
				format=serialization.PrivateFormat.PKCS8,
				encryption_algorithm=serialization.NoEncryption()
			)
			pub_raw = priv.public_key().public_bytes(
				encoding=serialization.Encoding.Raw,
				format=serialization.PublicFormat.Raw
			)
			with open(key_path, 'wb') as f:
				f.write(priv_pem)
			with open(pub_path, 'wb') as f:
				f.write(pub_raw)
			print('Generated development Ed25519 keypair at', key_path, pub_path)
		except Exception:
			return None
	try:
		with open(key_path, 'rb') as f:
			data = f.read()
			return serialization.load_pem_private_key(data, password=None)
	except Exception:
		return None


def _load_public_key_raw():
	pub_path = os.getenv('TOOLBELT_PUB_RAW') or os.path.join(os.path.dirname(__file__), 'keys', 'dev_ed25519_public.raw')
	if not os.path.exists(pub_path):
		return None
	try:
		with open(pub_path, 'rb') as f:
			return f.read()
	except Exception:
		return None


def _consent_allows():
	c = read_consent(CFG.get('LUCY_CONSENT_PATH'))
	return bool(c.get('os_integration'))


PRIV_KEY = _load_private_key()
PUB_RAW = _load_public_key_raw()


def _sign_decision_token(token: str) -> str:
	"""Sign the decision token (hex) with the Ed25519 private key and return base64 signature."""
	if not PRIV_KEY:
		return ''
	sig = PRIV_KEY.sign(token.encode('utf-8'))
	# raw signature for backward compatibility
	raw_b64 = base64.b64encode(sig).decode('utf-8')
	# produce compact JWS (EdDSA) with token in 'dt' claim
	headers = {"alg": "EdDSA", "kid": "dev-ed25519-1"}
	payload = {"dt": token, "iat": int(time.time())}
	try:
		jws = jwt.encode(payload, PRIV_KEY.private_bytes(encoding=serialization.Encoding.Raw, format=serialization.PrivateFormat.Raw, encryption_algorithm=serialization.NoEncryption()), algorithm='EdDSA', headers=headers)
	except Exception:
		# fallback: return raw signature
		return raw_b64
	return jws + '::' + raw_b64


def _verify_decision_token(token: str, signature_b64: str) -> bool:
	# Accept either raw base64 signature or compact JWS::raw format
	if not PUB_RAW:
		return False
	try:
		if '::' in signature_b64:
			jws, raw = signature_b64.split('::', 1)
			# verify JWS using raw public bytes
			pub = Ed25519PublicKey.from_public_bytes(PUB_RAW)
			pub_key_raw = PUB_RAW
			# verify JWS
			try:
				decoded = jwt.decode(jws, pub_key_raw, algorithms=['EdDSA'])
				return decoded.get('dt') == token
			except Exception:
				# fallback to raw signature
				sig = base64.b64decode(raw)
				pub.verify(sig, token.encode('utf-8'))
				return True
		else:
			sig = base64.b64decode(signature_b64)
			pub = Ed25519PublicKey.from_public_bytes(PUB_RAW)
			pub.verify(sig, token.encode('utf-8'))
			return True
	except (InvalidSignature, Exception):
		return False

app = FastAPI(title="Lucy Local Toolbelt (stub)")

class CursorMove(BaseModel):
	x: float
	y: float
	absolute: Optional[bool] = True

class Click(BaseModel):
	x: Optional[float]
	y: Optional[float]
	button: Optional[str] = "left"

class TypePayload(BaseModel):
	text: str

class SpotifyAction(BaseModel):
	action: str
	metadata: Optional[dict] = None

class TEExecute(BaseModel):
	prompt: str
	assets: Optional[dict] = None

class VerifyRequest(BaseModel):
	decision_token: str
	decision_signature: str


class FileDropped(BaseModel):
	path: str
	name: Optional[str]
	action: Optional[str]

@app.get("/health")
async def health():
	return {"status": "ok", "service": "toolbelt"}

@app.post("/cursor/move")
async def cursor_move(payload: CursorMove):
	token = _log_action("cursor.move", payload.dict(), governance="cursor")
	# TODO: integrate real cursor control (pyautogui or OS native) after governance checks
	if not FEATURE_OS_INTEGRATION:
		signature = _sign_decision_token(token)
		logging.info(json.dumps({"decision_token": token, "signed": bool(signature)}))
		return {"ok": True, "action": "cursor.move", "x": payload.x, "y": payload.y, "decision_token": token, "decision_signature": signature, "note": "OS integration disabled"}
	signature = _sign_decision_token(token)
	logging.info(json.dumps({"decision_token": token, "signed": bool(signature)}))
	return {"ok": True, "action": "cursor.move", "x": payload.x, "y": payload.y, "decision_token": token, "decision_signature": signature}

@app.post("/cursor/click")
async def cursor_click(payload: Click):
	token = _log_action("cursor.click", payload.dict(), governance="cursor")
	signature = _sign_decision_token(token)
	logging.info(json.dumps({"decision_token": token, "signed": bool(signature)}))
	if not FEATURE_OS_INTEGRATION or not _consent_allows():
		return {"ok": True, "action": "cursor.click", "button": payload.button, "decision_token": token, "decision_signature": signature, "note": "OS integration disabled or consent not granted"}
	return {"ok": True, "action": "cursor.click", "button": payload.button, "decision_token": token, "decision_signature": signature}

@app.post("/keyboard/type")
async def keyboard_type(payload: TypePayload):
	token = _log_action("keyboard.type", payload.dict(), governance="keyboard")
	signature = _sign_decision_token(token)
	logging.info(json.dumps({"decision_token": token, "signed": bool(signature)}))
	if not FEATURE_OS_INTEGRATION or not _consent_allows():
		return {"ok": True, "action": "keyboard.type", "decision_token": token, "decision_signature": signature, "note": "OS integration disabled or consent not granted"}
	return {"ok": True, "action": "keyboard.type", "decision_token": token, "decision_signature": signature}

@app.post("/spotify/control")
async def spotify_control(payload: SpotifyAction):
	token = _log_action("spotify.control", payload.dict(), governance="media")
	signature = _sign_decision_token(token)
	logging.info(json.dumps({"decision_token": token, "signed": bool(signature)}))
	# TODO: implement OS-level Spotify control (MediaSession APIs / platform integration)
	if not FEATURE_OS_INTEGRATION or not _consent_allows():
		return {"ok": True, "action": "spotify", "command": payload.action, "decision_token": token, "decision_signature": signature, "note": "OS integration disabled or consent not granted"}
	return {"ok": True, "action": "spotify", "command": payload.action, "decision_token": token, "decision_signature": signature}

@app.post("/te_v2/execute")
async def te_v2_execute(payload: TEExecute):
	token = _log_action("te_v2.execute", payload.dict(), governance="te_v2")
	signature = _sign_decision_token(token)
	logging.info(f"te_v2.execute -> prompt={payload.prompt}, assets={payload.assets}")
	# Stubbed result: In production, call TE v2 generator, apply gating, watermark, sign result
	result = {
		"result_id": "stub-result-1",
		"status": "generated",
		"decision_token": token,
		"decision_signature": signature,
		"note": "This is a stub response. Replace with TE v2 integration." 
	}
	logging.info(f"te_v2.result -> {result}")
	return result

@app.post("/mirror/register")
async def mirror_register(payload: dict):
	# Accepts registration data from the Electron dual-browser widget or the cloud browser mirror
	token = _log_action("mirror.register", payload, governance="mirror")
	signature = _sign_decision_token(token)
	logging.info(json.dumps({"decision_token": token, "signed": bool(signature)}))
	return {"ok": True, "decision_token": token, "decision_signature": signature}


@app.post('/verify')
async def verify_sig(payload: VerifyRequest):
	valid = _verify_decision_token(payload.decision_token, payload.decision_signature)
	return {"valid": bool(valid)}


@app.post('/file/dropped')
async def file_dropped(payload: FileDropped):
	# Log the dropped file and requested action, return guidance
	token = _log_action('file.dropped', payload.dict(), governance='file')
	signature = _sign_decision_token(token)
	logging.info(json.dumps({'dropped': payload.path, 'action': payload.action, 'decision_token': token}))
	# Simple routing: if action == 'set_wallpaper' call wallpaper endpoint
	if payload.action == 'set_wallpaper':
		if not FEATURE_OS_INTEGRATION or not _consent_allows():
			return {'ok': False, 'error': 'os integration disabled or consent not granted'}
		# delegate to wallpaper set endpoint
		return await wallpaper_set({'path': payload.path})
	return {'ok': True, 'decision_token': token, 'decision_signature': signature}


@app.post('/wallpaper/set')
async def wallpaper_set(payload: dict):
	# Minimal platform-specific wallpaper setter
	path = payload.get('path')
	if not path:
		raise HTTPException(status_code=400, detail='path required')
	if not FEATURE_OS_INTEGRATION or not _consent_allows():
		return {'ok': False, 'error': 'os integration disabled or consent not granted'}
	try:
		if os.name == 'nt':
			# Windows: use SystemParametersInfo via PowerShell script
			# PowerShell command to set wallpaper (uses COM object via Windows Script Host)
			try:
				import subprocess
				script = f"& {{Add-Type -AssemblyName PresentationFramework; $path='{path}'; (Add-Type -MemberDefinition \"[DllImport(\\\"user32.dll\\\")]public static extern bool SystemParametersInfo(int uAction, int uParam, string lpvParam, int fuWinIni);\" -Name Win32 -Namespace Win32 -PassThru)::SystemParametersInfo(20,0,$path,3)}}"
				subprocess.run(['powershell', '-Command', script], check=True)
				return {'ok': True}
			except Exception:
				return {'ok': False, 'error': 'windows wallpaper set failed'}
		elif sys.platform == 'darwin':
			# macOS: use AppleScript via osascript
			try:
				import subprocess
				osa = f"osascript -e 'tell application \"System Events\" to set picture of every desktop to \"{path}\"'"
				subprocess.run(osa, shell=True, check=True)
				return {'ok': True}
			except Exception:
				return {'ok': False, 'error': 'mac wallpaper set failed'}
		else:
			# Try gsettings
			import subprocess
			try:
				subprocess.run(['gsettings', 'set', 'org.gnome.desktop.background', 'picture-uri', f'file://{path}'])
				return {'ok': True}
			except Exception:
				return {'ok': False, 'error': 'failed to set wallpaper on linux'}
	except Exception as e:
		return {'ok': False, 'error': str(e)}


@app.get('/governance/status')
async def governance_status():
	return {"ok": True, "feature_os_integration": FEATURE_OS_INTEGRATION, "pub_raw_available": bool(PUB_RAW)}


@app.get('/.well-known/jwks.json')
async def jwks():
	"""Return a minimal JWKS-like object for the Ed25519 public key (raw bytes -> base64url).

	This is a minimal development JWKS scaffold. In production, expose proper JWKS with key ids (kid) and metadata.
	"""
	if not PUB_RAW:
		return {"keys": []}
	# base64url without padding
	b64 = base64.urlsafe_b64encode(PUB_RAW).rstrip(b'=').decode('utf-8')
	jwk = {
		"kty": "OKP",
		"crv": "Ed25519",
		"x": b64,
		"kid": "dev-ed25519-1",
		"alg": "EdDSA"
	}
	return {"keys": [jwk]}
