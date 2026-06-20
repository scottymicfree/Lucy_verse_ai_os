import requests
from dataclasses import dataclass

@dataclass
class ServiceStatus:
    name: str
    url: str
    ok: bool
    code: int | None
    error: str | None

class ServiceProbe:
    def __init__(self, timeout: float = 2.0):
        self.timeout = timeout

    def check(self, name: str, url: str) -> ServiceStatus:
        if not url:
             return ServiceStatus(
                name=name,
                url=url,
                ok=False,
                code=None,
                error="URL not configured",
            )
             
        try:
            r = requests.get(url, timeout=self.timeout)
            return ServiceStatus(
                name=name,
                url=url,
                ok=r.status_code == 200,
                code=r.status_code,
                error=None if r.status_code == 200 else r.text[:200],
            )
        except Exception as e:
            return ServiceStatus(
                name=name,
                url=url,
                ok=False,
                code=None,
                error=str(e),
            )
