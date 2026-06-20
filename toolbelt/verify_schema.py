from pydantic import BaseModel

class VerifyRequest(BaseModel):
	decision_token: str
	decision_signature: str
