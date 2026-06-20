from fastapi import FastAPI, HTTPException, Depends, Header
import os
from pydantic import BaseModel, HttpUrl, validator
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Any, Literal

app = FastAPI(title="Lucy Tool Registry")

# Shared secret for auth (can be overridden via env var)
SHARED_SECRET = os.getenv("TOOL_REGISTRY_SECRET", "lucy-secret")

def verify_secret(x_secret_key: str = Header(...)):
    if x_secret_key != SHARED_SECRET:
        raise HTTPException(status_code=401, detail="Invalid secret")
    return True

class Tool(BaseModel):
    name: str
    base_url: HttpUrl
    capabilities: list[str]
    description: str
    openapi_url: HttpUrl

    @validator("capabilities")
    def non_empty_caps(cls, v):
        if not v:
            raise ValueError("capabilities list cannot be empty")
        return v

# Marketplace plugin models
Status = Literal["draft", "approved", "disabled"]

class Capability(BaseModel):
    name: str
    description: str
    method: str
    path: str
    input_schema: Dict[str, Any]
    output_schema: Dict[str, Any]
    required_permissions: List[str] = []

class PluginManifest(BaseModel):
    id: str
    name: str
    version: str
    publisher: str
    entrypoint: Dict[str, Any]
    capabilities: List[Capability]
    permissions: List[str] = []
    status: Status = "draft"
    created_at: datetime | None = None
    updated_at: datetime | None = None

# In-memory plugin storage
PLUGINS: dict[str, PluginManifest] = {}

# Simple JSON persistence helper
DATA_DIR = Path("/app/data")
TOOLS_FILE = DATA_DIR / "tools.json"

def load_all() -> list[Tool]:
    if not TOOLS_FILE.exists():
        return []
    import json
    with TOOLS_FILE.open() as f:
        data = json.load(f)
    return [Tool(**item) for item in data]

def save_all(tools: list[Tool]):
    import json
    with TOOLS_FILE.open("w") as f:
        json.dump([t.dict() for t in tools], f, indent=2)

def get_tool(name: str) -> Tool | None:
    for t in load_all():
        if t.name == name:
            return t
    return None

@app.get("/tools", response_model=list[Tool])
def list_tools():
    return load_all()

@app.get("/tools/{name}", response_model=Tool)
def get_tool_endpoint(name: str):
    tool = get_tool(name)
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")
    return tool

@app.post("/tools/register", response_model=Tool, dependencies=[Depends(verify_secret)])
def register_tool(tool: Tool):
    tools = [t for t in load_all() if t.name != tool.name]
    tools.append(tool)
    save_all(tools)
    return tool

@app.delete("/tools/{name}", dependencies=[Depends(verify_secret)])
def delete_tool(name: str):
    tools = load_all()
    new = [t for t in tools if t.name != name]
    if len(new) == len(tools):
        raise HTTPException(status_code=404, detail="Tool not found")
    save_all(new)
    return {"detail": "Deleted"}

# ----------------------------------------------------------------------
# Marketplace plugin endpoints
# ----------------------------------------------------------------------
@app.post("/plugins", response_model=PluginManifest, dependencies=[Depends(verify_secret)])
def register_plugin(manifest: PluginManifest):
    now = datetime.utcnow()
    manifest.created_at = now
    manifest.updated_at = now
    PLUGINS[manifest.id] = manifest
    return manifest

@app.get("/plugins", response_model=List[PluginManifest])
def list_plugins(status: Status | None = None):
    plugins = list(PLUGINS.values())
    if status:
        plugins = [p for p in plugins if p.status == status]
    return plugins

@app.get("/plugins/{plugin_id}", response_model=PluginManifest)
def get_plugin(plugin_id: str):
    return PLUGINS[plugin_id]

@app.post("/plugins/{plugin_id}/approve", response_model=PluginManifest, dependencies=[Depends(verify_secret)])
def approve_plugin(plugin_id: str):
    plugin = PLUGINS[plugin_id]
    plugin.status = "approved"
    plugin.updated_at = datetime.utcnow()
    return plugin

@app.post("/plugins/{plugin_id}/disable", response_model=PluginManifest, dependencies=[Depends(verify_secret)])
def disable_plugin(plugin_id: str):
    plugin = PLUGINS[plugin_id]
    plugin.status = "disabled"
    plugin.updated_at = datetime.utcnow()
    return plugin
