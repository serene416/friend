FROM pytorch/pytorch:2.1.0-cuda12.1-cudnn8-runtime

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Assuming the AI service will also expose an API or run as a worker
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
