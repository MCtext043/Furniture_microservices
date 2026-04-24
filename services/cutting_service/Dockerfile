FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY services/cutting_service /app/services/cutting_service

CMD ["uvicorn", "services.cutting_service.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
