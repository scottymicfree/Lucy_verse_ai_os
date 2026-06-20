from fastapi import FastAPI, Depends
from engine import SelfExtensionEngine
from validator import verify_secret

app = FastAPI(title="Lucy Self-Extension Engine")
engine = SelfExtensionEngine()

@app.on_event("startup")
async def startup():
    await engine.start_heartbeat()

@app.post("/extend")
async def propose_extension(payload: dict, authorized: bool = Depends(verify_secret)):
    proposal_id = await engine.enqueue_proposal(payload)
    return {"proposal_id": proposal_id, "status": "queued"}

@app.get("/proposals")
async def list_proposals(authorized: bool = Depends(verify_secret)):
    return await engine.list_pending()

@app.post("/proposals/{proposal_id}/approve")
async def approve(proposal_id: int, authorized: bool = Depends(verify_secret)):
    result = await engine.approve(proposal_id)
    return {"proposal_id": proposal_id, "result": result}

@app.post("/proposals/{proposal_id}/reject")
async def reject(proposal_id: int, authorized: bool = Depends(verify_secret)):
    result = await engine.reject(proposal_id)
    return {"proposal_id": proposal_id, "result": result}
