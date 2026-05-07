FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY services/__init__.py /app/services/__init__.py
COPY services/gateway_service /app/services/gateway_service

ENV PYTHONPATH=/app

CMD ["uvicorn", "services.gateway_service.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
