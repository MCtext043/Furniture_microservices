FROM python:3.12-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends libpq5 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY common /app/common
COPY services/__init__.py /app/services/__init__.py
COPY services/auth_service /app/services/auth_service

ENV PYTHONPATH=/app

CMD ["uvicorn", "services.auth_service.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
