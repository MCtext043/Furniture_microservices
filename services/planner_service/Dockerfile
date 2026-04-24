FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY services/planner_service /app/services/planner_service

CMD ["uvicorn", "services.planner_service.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
