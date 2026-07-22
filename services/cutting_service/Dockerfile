FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY common /app/common
COPY services/__init__.py /app/services/__init__.py
COPY services/cutting_service /app/services/cutting_service

ENV PYTHONPATH=/app

CMD ["uvicorn", "services.cutting_service.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
