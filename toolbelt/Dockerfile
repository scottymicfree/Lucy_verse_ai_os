FROM python:3.11-slim
WORKDIR /app
COPY server.py /app/server.py
RUN pip install fastapi uvicorn pydantic
EXPOSE 8001
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8001"]
