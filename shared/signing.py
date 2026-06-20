from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey, Ed25519PublicKey
from cryptography.hazmat.primitives import serialization
import base64
import os
import time
import jwt

def load_private_key(path=None):
	path = path or os.getenv('TOOLBELT_PRIV_KEY')
	if not path or not os.path.exists(path):
		return None
	with open(path, 'rb') as f:
		return serialization.load_pem_private_key(f.read(), password=None)

def load_public_raw(path=None):
	path = path or os.getenv('TOOLBELT_PUB_RAW')
	if not path or not os.path.exists(path):
		return None
	with open(path, 'rb') as f:
		return f.read()

def sign_token(priv_key, token):
	if not priv_key:
		return ''
	sig = priv_key.sign(token.encode('utf-8'))
	raw_b64 = base64.b64encode(sig).decode('utf-8')
	headers = {"alg": "EdDSA", "kid": "dev-ed25519-1"}
	payload = {"dt": token, "iat": int(time.time())}
	try:
		jws = jwt.encode(payload, priv_key.private_bytes(encoding=serialization.Encoding.Raw, format=serialization.PrivateFormat.Raw, encryption_algorithm=serialization.NoEncryption()), algorithm='EdDSA', headers=headers)
	except Exception:
		return raw_b64
	return jws + '::' + raw_b64
