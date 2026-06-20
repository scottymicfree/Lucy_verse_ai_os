FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY . /app
EXPOSE 8008
ENV SCHEDULER_SECRET=${SCHEDULER_SECRET:-lucy-secret}
CMD ["rq", "worker", "lucy_tasks", "--url", "redis://redis:6379"]
