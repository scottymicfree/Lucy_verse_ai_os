"""Minimal sandbox stub — static checks always pass until real sandbox is integrated."""

class Sandbox:
    def run_static_checks(self, diff_text: str) -> dict:
        return {"ok": True, "warnings": []}

    def run(self, code: str) -> dict:
        return {"ok": True, "output": ""}
