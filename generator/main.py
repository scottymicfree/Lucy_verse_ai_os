from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import os
import json
import base64
import time
import uuid
from nacl.signing import VerifyKey, SigningKey
import httpx
import subprocess
import hashlib
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric.utils import encode_dss_signature
from cryptography.hazmat.primitives.serialization import load_pem_private_key
import requests

DATA_DIR = os.environ.get('GENERATOR_DATA', '/data/generator')
os.makedirs(DATA_DIR, exist_ok=True)
MANIFEST_DB = os.path.join(DATA_DIR, 'manifests')
os.makedirs(MANIFEST_DB, exist_ok=True)
KEY_DB = os.path.join(DATA_DIR, 'keys')
os.makedirs(KEY_DB, exist_ok=True)

def load_or_create_es256_key():
	key_path = os.path.join(KEY_DB, 'es256_key.pem')
	if os.path.exists(key_path):
		with open(key_path, 'rb') as f:
			return load_pem_private_key(f.read(), password=None)
	# generate and persist
	priv = ec.generate_private_key(ec.SECP256R1())
	pem = priv.private_bytes(encoding=serialization.Encoding.PEM, format=serialization.PrivateFormat.PKCS8, encryption_algorithm=serialization.NoEncryption())
	with open(key_path, 'wb') as f:
		f.write(pem)
	return priv


def sign_manifest_es256(manifest: dict) -> dict:
	# canonicalize
	priv = load_or_create_es256_key()
	canon = json.dumps(manifest, separators=(',', ':'), sort_keys=True).encode()
	# compute digest
	digest = hashes.Hash(hashes.SHA256())
	digest.update(canon)
	h = digest.finalize()
	# sign using ECDSA P-256, DER signature (r,s)
	sig_der = priv.sign(canon, ec.ECDSA(hashes.SHA256()))
	# try to get TSA timestamp if TSA_URL provided
	tsa_url = os.environ.get('TSA_URL')
	tsa_token = None
	if tsa_url:
		try:
			# RFC3161 request: use requests to get timestamp token (simplified; many TSA services require ASN.1 request; we treat TSA as simple POST echo)
			r = requests.post(tsa_url, data=canon, timeout=5.0)
			if r.status_code == 200:
				tsa_token = r.content.hex()
		except Exception:
			tsa_token = None
	return {"manifest": manifest, "signature_der_hex": sig_der.hex(), "tsa_token": tsa_token}

app = FastAPI()

TE_PRIV_KEY = os.environ.get('TE_PRIV_KEY')
TE_PUB_KEY = os.environ.get('TE_PUB_KEY')
TE_KID = os.environ.get('TE_KID', f"te-{os.environ.get('KEY_ID','2026-06')}")

DATAVAULT_URL = os.environ.get('DATAVAULT_URL', 'http://datavault:8012/log')
JWKS_URL = os.environ.get('ORCH_JWKS', 'http://orchestrator:8020/.well-known/jwks.json')

class MultimodalReq(BaseModel):
	permit: dict
	payload: dict


def verify_kid_signature(permit: dict, jwks_url: str) -> bool:
	kid = permit.get('kid')
	sig = permit.get('signature')
	payload = permit.get('payload')
	if not kid or not sig or not payload:
		return False
	canon = json.dumps(payload, separators=(',', ':'), sort_keys=True).encode()
	# fetch jwks
	try:
		r = httpx.get(jwks_url, timeout=3.0)
		r.raise_for_status()
		data = r.json()
		for k in data.get('keys', []):
			if k.get('kid') == kid:
				x = k.get('x')
				# base64url -> bytes
				mod = x + '=='
				bb = base64.urlsafe_b64decode(mod)
				vk = VerifyKey(bb)
				vk.verify(canon, bytes.fromhex(sig))
				return True
	except Exception:
		# fallback: if ORCH_PUB_KEY provided as hex, try that
		pub_hex = os.environ.get('ORCH_PUB_KEY')
		if pub_hex:
			try:
				vk = VerifyKey(bytes.fromhex(pub_hex))
				vk.verify(canon, bytes.fromhex(sig))
				return True
			except Exception:
				return False
		return False
	return False


def demographics_gate(payload: dict, permit_payload: dict) -> tuple[bool, dict]:
	# simple gate: extract age from payload.params.demographics or permit decision token
	age = None
	# payload may include demographics
	params = payload.get('params') or {}
	demo = params.get('demographics') or {}
	age = demo.get('age')
	# fallback: check decision_token inside permit payload
	try:
		dt = permit_payload.get('decision_token') or {}
		token = dt.get('token') or {}
		if not age:
			age = token.get('age')
	except Exception:
		pass

	# if age known and <18 and prompt requests mature content, deny
	mature_flag = params.get('mature', False) or ('mature' in (payload.get('prompt') or '').lower())
	if age is not None and int(age) < 18 and mature_flag:
		denial = {"ok": False, "reason": "demographics_restriction", "age": age}
		return False, denial
	return True, {}


def apply_visible_watermark(input_path: str, output_path: str, watermark_text: str = 'AI GENERATED') -> bool:
	# Use ffmpeg drawtext to overlay watermark at bottom-right
	try:
		cmd = [
			'ffmpeg', '-y', '-i', input_path,
			'-vf', f"drawtext=text='{watermark_text}':fontcolor=white@0.4:fontsize=24:x=w-text_w-20:y=h-th-20",
			'-c:v', 'libx264', '-crf', '23', '-preset', 'fast', output_path
		]
		subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
		return True
	except Exception:
		return False


def embed_invisible_watermark_stub(input_path: str, uuid_str: str) -> bool:
	# placeholder: write uuid into sidecar file to simulate invisible watermark embedding
	try:
		sidecar = f"{input_path}.watermark.txt"
		with open(sidecar, 'w') as f:
			f.write(uuid_str)
		return True
	except Exception:
		return False


def create_c2pa_manifest_stub(prompt: str, model_info: dict, demographics: dict, watermark_uuid: str) -> dict:
	manifest = {
		'id': watermark_uuid,
		'prompt': prompt,
		'model': model_info,
		'demographics_decision': demographics,
		'timestamp': time.time()
	}
	# store manifest file
	path = os.path.join(MANIFEST_DB, f"{watermark_uuid}.json")
	with open(path, 'w') as f:
		json.dump(manifest, f)
	# sign manifest with ES256 and attach TSA token if available
	signed = sign_manifest_es256(manifest)
	signed_path = os.path.join(MANIFEST_DB, f"{watermark_uuid}.signed.json")
	with open(signed_path, 'w') as f:
		json.dump(signed, f)
	return signed


@app.post('/execute_multimodal')
async def execute_multimodal(req: MultimodalReq):
	# verify permit using kid/JWKS
	if not verify_kid_signature(req.permit, JWKS_URL):
		raise HTTPException(status_code=403, detail='invalid_permit_signature')

	# TODO: verify decision token and audit receipt similarly (omitted for brevity)

	# verify demographics gating
	allowed, denial = demographics_gate(req.payload, req.permit.get('payload'))
	if not allowed:
		# produce denial receipt (unsigned for now)
		return {"ok": False, "reason": "demographics_denied", "details": denial}

	# simulate generation: write a small media file
	output_id = uuid.uuid4().hex
	raw_media = os.path.join(DATA_DIR, f"{output_id}.mp4")
	with open(raw_media, 'wb') as f:
		f.write(b"FAKE-VIDEO-BYTES")

	# apply visible watermark
	watermarked = os.path.join(DATA_DIR, f"{output_id}.watermarked.mp4")
	apply_visible_watermark(raw_media, watermarked, watermark_text='AI GENERATED - 18+')

	# embed invisible watermark stub (writes sidecar)
	watermark_uuid = uuid.uuid4().hex
	embed_invisible_watermark_stub(watermarked, watermark_uuid)

	# create C2PA manifest stub
	manifest = create_c2pa_manifest_stub(req.payload.get('prompt', ''), {"model": "local-hunyuan"}, {"age_checked": True}, watermark_uuid)

	# compute result hash
	with open(watermarked, 'rb') as f:
		h = hashlib.sha256(f.read()).hexdigest()

	# send result metadata to datavault and obtain receipt
	dv_payload = {"result_hash": h, "permit": req.permit, "watermark_uuid": watermark_uuid, "manifest": manifest}
	try:
		r = httpx.post(DATAVAULT_URL, json={"source": "trusted-executor-v2", "payload": dv_payload}, timeout=5.0)
		r.raise_for_status()
		dv = r.json()
	except Exception:
		dv = {"ok": False}

	# produce result receipt signed by TE_PRIV_KEY if available (hex)
	try:
		if TE_PRIV_KEY:
			sk = SigningKey(bytes.fromhex(TE_PRIV_KEY))
			payload = {"result_hash": h, "permit_hash": req.permit.get('signature'), "watermark_uuid": watermark_uuid, "timestamp": time.time()}
			canon = json.dumps(payload, separators=(',', ':'), sort_keys=True).encode()
			sig = sk.sign(canon).signature.hex()
			receipt = {"payload": payload, "signature": sig, "kid": TE_KID, "alg": "Ed25519"}
		else:
			receipt = {"payload": {"result_hash": h, "watermark_uuid": watermark_uuid}, "signature": None}
	except Exception:
		receipt = {"payload": {"result_hash": h, "watermark_uuid": watermark_uuid}, "signature": None}

	return {"ok": True, "media_url": watermarked, "result_receipt": receipt, "datavault": dv, "manifest": manifest}
