import os
import httpx

EMMA_URL = os.getenv("EMMA_NOTIFY_URL", "http://emma:8010/notify")
EMMA_SECRET = os.getenv("EMMA_SECRET", "lucy-secret")

async def notify_emma(event_type: str, payload: dict):
    async with httpx.AsyncClient() as client:
        try:
            await client.post(
                EMMA_URL,
                json={"event": event_type, "payload": payload},
                headers={"x-secret-key": EMMA_SECRET},
                timeout=10,
            )
        except Exception as e:
            print(f"Failed to notify EMMA ({event_type}): {e}")
