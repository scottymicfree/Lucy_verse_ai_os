from fastapi import Header, HTTPException
import os

def verify_secret(x_secret_key: str = Header(...)):
    secret = os.getenv("SELF_EXT_SECRET", "lucy-secret")
    if x_secret_key != secret:
        raise HTTPException(status_code=401, detail="Invalid secret")
    return True
