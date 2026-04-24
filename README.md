# Furniture Microservices Backend (FastAPI)

Стартовый backend под 3 приложения мебельного бизнеса:

1. Маркетплейс (каталог, фильтры, категории, поиск)
2. Раскрой листов ДСП (оптимизация размещения деталей)
3. Планировщик помещения (размещение мебели в 3D-сцене)

## Технологии

- FastAPI
- PostgreSQL
- SQLAlchemy
- Pytest
- Swagger/OpenAPI (`/docs`, `/openapi.json`)

## Структура

- `services/catalog_service` — каталог товаров
- `services/cutting_service` — оптимизация раскроя
- `services/planner_service` — проекты помещений и размещение мебели
- `tests` — API-тесты по каждому сервису

## Запуск локально

```bash
python -m pip install -r requirements.txt
uvicorn services.catalog_service.app.main:app --reload --port 8001
uvicorn services.cutting_service.app.main:app --reload --port 8002
uvicorn services.planner_service.app.main:app --reload --port 8003
```

Swagger для сервисов:

- http://localhost:8001/docs
- http://localhost:8002/docs
- http://localhost:8003/docs

## Запуск через Docker Compose

```bash
docker compose up --build
```

## Тесты

```bash
pytest
```

## Что делать дальше

- Добавить API Gateway
- Добавить миграции Alembic
- Вынести auth в отдельный сервис (JWT/RBAC)
- Добавить брокер сообщений (RabbitMQ/Kafka) и event-driven интеграции
- Добавить CDN/хранилище для 3D-моделей и изображений
