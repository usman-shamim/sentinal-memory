FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV PORT=8400
EXPOSE 8400

# Default: run FastAPI server. Override CMD to run worker instead.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8400"]
