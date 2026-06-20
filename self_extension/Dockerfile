FROM python:3.11-slim
WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . /app

EXPOSE 8004
ENV SELF_EXT_SECRET=${SELF_EXT_SECRET:-lucy-secret}
ENV REDIS_URL=redis://redis:6379
ENV EMMA_NOTIFY_URL=http://emma:8010/notify

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8004"]
