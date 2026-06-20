FROM python:3.11-slim
WORKDIR /app
COPY main.py /app/main.py
RUN pip install fastapi uvicorn requests pydantic PyNaCl
EXPOSE 8013
CMD ["python", "main.py"]
