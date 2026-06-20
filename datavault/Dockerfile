FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app

WORKDIR /app

# system deps for healthcheck
RUN apt-get update \
	&& apt-get install -y --no-install-recommends curl ca-certificates \
	&& rm -rf /var/lib/apt/lists/*

COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

# copy datavault app
COPY . /app/src/datavault

# ensure data directory exists
RUN mkdir -p /data && chown -R root:root /data

EXPOSE 8012

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s CMD curl -f http://localhost:8012/health || exit 1

CMD ["uvicorn", "src.datavault.main:app", "--host", "0.0.0.0", "--port", "8012"]
