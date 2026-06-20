import json
from pathlib import Path
from .main import Tool

class ToolRegistry:
    def __init__(self, data_dir: Path = Path("/app/data")):
        self.file = data_dir / "tools.json"
        self.file.parent.mkdir(parents=True, exist_ok=True)
        if not self.file.exists():
            self.file.write_text("[]")

    def load_all(self) -> list[Tool]:
        with self.file.open() as f:
            data = json.load(f)
        return [Tool(**item) for item in data]

    def get(self, name: str) -> Tool | None:
        for t in self.load_all():
            if t.name == name:
                return t
        return None

    def save(self, tool: Tool) -> None:
        tools = [t for t in self.load_all() if t.name != tool.name]
        tools.append(tool)
        self._write(tools)

    def delete(self, name: str) -> bool:
        tools = self.load_all()
        new = [t for t in tools if t.name != name]
        if len(new) == len(tools):
            return False
        self._write(new)
        return True

    def _write(self, tools: list[Tool]):
        with self.file.open("w") as f:
            json.dump([t.dict() for t in tools], f, indent=2)
