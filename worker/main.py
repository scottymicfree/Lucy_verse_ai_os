from fastapi import FastAPI
import os
import threading
from .worker import start_worker

app = FastAPI()

@app.on_event("startup")
def startup_event():
    # Start the RQ worker in a background thread
    threading.Thread(target=start_worker, daemon=True).start()

@app.get("/health")
def health():
    return {"status": "ok"}
