FROM python:3.11-slim
WORKDIR /app
COPY . /app/src
ENV PYTHONPATH=/app/src
RUN pip install fastapi uvicorn requests pydantic
EXPOSE 8020
CMD ["python", "-m", "orchestrator.server"]
