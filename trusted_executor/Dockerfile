FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app

WORKDIR /app

RUN apt-get update \
	&& apt-get install -y --no-install-recommends curl ca-certificates xz-utils tar \
	&& rm -rf /var/lib/apt/lists/*

COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

# copy trusted-executor app
COPY . /app/src/trusted_executor

# Install wasmtime static binary (best-effort). If it fails, the app warns and falls back.
RUN set -eux; \
    WASMTIME_VER=v12.0.0; \
    URL="https://github.com/bytecodealliance/wasmtime/releases/download/${WASMTIME_VER}/wasmtime-${WASMTIME_VER}-x86_64-linux.tar.xz"; \
    curl -fsSL ${URL} -o /tmp/wasmtime.tar.xz; \
    if [ -f /tmp/wasmtime.tar.xz ]; then \
        mkdir -p /opt/wasmtime && tar -xJf /tmp/wasmtime.tar.xz -C /opt/wasmtime --strip-components=1 && ln -s /opt/wasmtime/wasmtime /usr/local/bin/wasmtime && rm /tmp/wasmtime.tar.xz; \
    else \
        echo 'Failed to download wasmtime ${WASMTIME_VER}' && exit 1; \
    fi; \
    if ! command -v wasmtime > /dev/null; then echo 'wasmtime binary missing after install' && exit 1; fi

EXPOSE 8040

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s CMD curl -f http://localhost:8040/health || exit 1

CMD ["uvicorn", "src.trusted_executor.main:app", "--host", "0.0.0.0", "--port", "8040"]
