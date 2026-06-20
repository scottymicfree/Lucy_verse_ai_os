from cryptography.hazmat.primitives.asymmetric import ed25519
from cryptography.hazmat.primitives import serialization

# Generate dev keys (for developer/local use only).
# In production, generate and store keys externally (CI secrets, HSM, etc.).

private_key = ed25519.Ed25519PrivateKey.generate()
public_key = private_key.public_key()

priv_bytes = private_key.private_bytes(
	encoding=serialization.Encoding.PEM,
	format=serialization.PrivateFormat.PKCS8,
	encryption_algorithm=serialization.NoEncryption()
)

pub_bytes = public_key.public_bytes(
	encoding=serialization.Encoding.Raw,
	format=serialization.PublicFormat.Raw
)

with open('src/toolbelt/keys/dev_ed25519_private.pem', 'wb') as f:
	f.write(priv_bytes)

with open('src/toolbelt/keys/dev_ed25519_public.raw', 'wb') as f:
	f.write(pub_bytes)

print('Generated dev keys: dev_ed25519_private.pem and dev_ed25519_public.raw')
