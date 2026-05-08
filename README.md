# Furniture — микросервисный backend (FastAPI)

Backend для задач мебельного производства и ритейла: каталог маркетплейса, расчёт раскроя листового материала, планирование расстановки мебели в помещении. Сервисы общаются с одной базой PostgreSQL; предусмотрены точки расширения: **API Gateway**, **JWT/RBAC**, **RabbitMQ**, **S3-compatible хранилище**, **Alembic**.

---

## Что уже реализовано

| Компонент | Назначение |
|-----------|------------|
| **catalog_service** | Категории, товары, фильтры, поиск, отзывы, корзина, избранное |
| **cutting_service** | Оптимизация раскроя, история задач (`/jobs`) |
| **planner_service** | Проекты помещений, размещение единиц мебели (размеры + координаты) |
| **auth_service** | Регистрация, выдача JWT, справочник ролей, bootstrap-админ |
| **gateway_service** | Единая точка входа: прокси с префиксами `/catalog`, `/cutting`, `/planner`, `/auth`, `/assets` |
| **assets_service** | Presigned PUT/GET для загрузки 3D/изображений (MinIO/S3 API) |
| **common** | Проверка JWT на защищённых операциях, публикация событий в RabbitMQ |
| **workers** | Пример consumer’а событий (`catalog_events_consumer.py`) |
| **Alembic** | Ревизия `alembic/versions/001_initial_schema.py`; job через `Dockerfile.migrate` |

---

## Функционал платформы

### Каталог и продажи
- Управление категориями и товарами (CRUD, фильтры, поиск, сортировка).
- Корзина и избранное пользователя.
- Отзывы по товарам и базовая аналитика по содержимому каталога.

### Производство (раскрой)
- Расчёт раскроя листового материала с автоматическим переносом на следующие листы.
- Учёт общей и послойной эффективности (`utilization_percent`, `used/unused area`).
- Выявление неразмещённых деталей (только когда деталь не помещается в лист).
- Хранение истории задач раскроя (`/jobs`).

### Планирование помещений
- Создание проектов помещения и расстановка мебели по координатам и размерам.
- Интеграция 3D-модели с генерацией деталей для производства (BOM).
- Подготовка раскроя на основе объектов комнаты.

### Авторизация и безопасность
- Регистрация и логин через `auth_service`.
- JWT-аутентификация и RBAC-проверки по ролям (`catalog:write`, `planner:write`, `cutting:run`, `assets:write`).

### Интеграции и файлы
- Event-driven публикация доменных событий в RabbitMQ.
- Presigned-ссылки для загрузки/выгрузки 3D-моделей и изображений через S3-совместимое хранилище.

---

## Технологии

| Технология | Где используется | За что отвечает |
|------------|------------------|-----------------|
| **Python 3.12** | Все backend-сервисы | Основной runtime и бизнес-логика |
| **FastAPI + Uvicorn** | `services/*` | REST API, валидация входных данных, docs `/docs` |
| **PostgreSQL 16** | `catalog/cutting/planner/auth` | Надёжное хранение доменных данных |
| **SQLAlchemy 2** | Все backend-сервисы с БД | ORM-модели, транзакции, доступ к данным |
| **Alembic** | `alembic/`, `Dockerfile.migrate` | Версионирование и применение миграций схемы |
| **PyJWT + passlib[bcrypt]** | `auth_service`, `common/jwt_auth.py` | Выдача/проверка JWT, хеширование паролей, RBAC |
| **Pika (RabbitMQ)** | `common/messaging.py`, `workers/*` | Асинхронный обмен событиями между сервисами |
| **boto3 (S3/MinIO)** | `assets_service` | Работа с объектным хранилищем и presigned URL |
| **pytest + TestClient/httpx** | `tests/*` | Интеграционные и API-тесты сервисов |
| **Docker + Docker Compose** | `docker-compose.yml`, `services/*/Dockerfile` | Локальный и demo-стенд со всеми зависимостями |

---

## Структура репозитория

```
Furniture/
├── common/                 # jwt_auth, messaging (RabbitMQ)
├── services/
│   ├── catalog_service/
│   ├── cutting_service/
│   ├── planner_service/
│   ├── auth_service/
│   ├── gateway_service/
│   └── assets_service/
├── workers/                # event-driven примеры
├── tests/                  # conftest + тесты по сервисам
├── alembic/                # миграции БД
├── scripts/postgres/       # init SQL (БД для тестов)
├── docker-compose.yml
├── Dockerfile.migrate       # одноразовый job: alembic upgrade head
├── requirements.txt
└── pytest.ini
```

Запуск из корня репозитория: в `PYTHONPATH` должен быть каталог проекта (см. ниже), иначе импорты `common` не сработают.

---

## Архитектура (логическая)

```mermaid
flowchart LR
  Client[Клиент / фронт]
  GW[Gateway :8080]
  Cat[Catalog :8001]
  Cut[Cutting :8002]
  Pln[Planner :8003]
  Auth[Auth :8004]
  Ast[Assets :8005]
  PG[(PostgreSQL)]
  RMQ[(RabbitMQ опц.)]
  S3[(MinIO/S3 опц.)]

  Client --> GW
  GW --> Cat
  GW --> Cut
  GW --> Pln
  GW --> Auth
  GW --> Ast
  Cat --> PG
  Cut --> PG
  Pln --> PG
  Auth --> PG
  Cat -.-> RMQ
  Cut -.-> RMQ
  Pln -.-> RMQ
  Ast --> S3
```

Порты в скобках — типичные для локального запуска; в Docker внутренний порт сервисов обычно **8000** с маппингом наружу.

### Архитектурные принципы
- **API Gateway как единая точка входа**: клиент работает через `gateway_service`, а не напрямую с каждым сервисом.
- **Разделение по доменам**: каталог, раскрой, планировщик, авторизация и assets изолированы в отдельных сервисах.
- **Общая модель безопасности**: единый JWT secret и единые role-проверки через модуль `common`.
- **Событийная интеграция**: сервисы публикуют доменные события без жёсткой синхронной связности.
- **Готовность к горизонтальному масштабированию**: stateless API + внешние инфраструктурные зависимости (PostgreSQL, RabbitMQ, S3).

---

## Переменные окружения

### Общие

| Переменная | Где используется | Описание |
|------------|------------------|----------|
| `DATABASE_URL` | catalog, cutting, planner, auth | `postgresql+psycopg2://user:pass@host:5432/dbname` |
| `JWT_SECRET_KEY` | auth (обяз.), catalog/cutting/planner/assets (опц.) | Секрет HS256. Если **не** задан на бизнес-сервисах — проверка JWT на запись **отключена** (удобно для разработки и тестов). |
| `PYTHONPATH` | локальный запуск | Должен содержать корень репозитория (`.`), чтобы работал пакет `common`. |

### Auth

| Переменная | По умолчанию | Описание |
|------------|--------------|----------|
| `JWT_ACCESS_TTL_MINUTES` | `60` | Срок жизни access token |
| `AUTH_BOOTSTRAP_USERNAME` / `AUTH_BOOTSTRAP_PASSWORD` | пусто | При старте создаётся пользователь с полным набором ролей (если ещё нет) |
| `AUTH_BOOTSTRAP_ROLES` | `admin,catalog:write,...` | CSV ролей для bootstrap-пользователя |

### Gateway

| Переменная | Локальный дефолт |
|------------|------------------|
| `GATEWAY_CATALOG_URL` | `http://localhost:8001` |
| `GATEWAY_CUTTING_URL` | `http://localhost:8002` |
| `GATEWAY_PLANNER_URL` | `http://localhost:8003` |
| `GATEWAY_AUTH_URL` | `http://localhost:8004` |
| `GATEWAY_ASSETS_URL` | `http://localhost:8005` |

### RabbitMQ (опционально)

| Переменная | Описание |
|------------|----------|
| `RABBITMQ_URL` | Напр. `amqp://guest:guest@localhost:5672/` — без неё публикация событий не выполняется |
| `RABBITMQ_EXCHANGE_EVENTS` | Имя topic-exchange (по умолчанию `furniture.events`) |

### MinIO / S3 (assets_service)

| Переменная | По умолчанию |
|------------|--------------|
| `S3_ENDPOINT_URL` | `http://localhost:9000` |
| `S3_ACCESS_KEY` / `S3_SECRET_KEY` | `minioadmin` |
| `S3_BUCKET` | `furniture-assets` |
| `CDN_PUBLIC_BASE_URL` | пусто — подставьте публичный URL CDN при необходимости |

### Тесты

| Переменная | Описание |
|------------|----------|
| `TEST_DATABASE_URL` | URL PostgreSQL для pytest (по умолчанию `.../furniture_test`) |

---

## Авторизация (JWT и RBAC)

1. Поднимите **auth_service** с заданным `JWT_SECRET_KEY` и той же `DATABASE_URL`, что и у остальных (таблицы `auth_*` в той же БД).
2. Получите токен: `POST /token` на **auth_service**, или через gateway: `POST /auth/token`.
3. На защищённых маршрутах передавайте заголовок `Authorization: Bearer <token>`.

Роли, на которые ориентируются сервисы (фрагмент):

- `catalog:write` — создание/изменение каталога, корзины, избранного, отзывов
- `planner:write` — проекты и расстановка мебели
- `cutting:run` — `POST /optimize`
- `assets:write` — presigned upload
- `admin` или `*` в списке ролей — полный доступ в рамках проверок

Регистрация `POST /register` создаёт пользователя с ролью `user` (без прав на запись в каталог и т.д., пока роли не назначат вручную в БД или через bootstrap).

---

## События (event-driven)

При настроенном `RABBITMQ_URL` сервисы публикуют сообщения в exchange `furniture.events` (topic), например:

- `catalog.product.created`
- `cutting.job.completed`
- `planner.project.created`, `planner.furniture.placed`

Пример подписчика: `python -m workers.catalog_events_consumer` (из корня, с `PYTHONPATH=.`).

---

## База данных и Alembic

Все доменные таблицы в одной базе **`furniture`** (или в БД из `DATABASE_URL`). Первая ревизия лежит в `alembic/versions/001_initial_schema.py`.

**Локально** (PostgreSQL уже доступен):

```powershell
$env:DATABASE_URL = "postgresql+psycopg2://furniture:furniture@127.0.0.1:5432/furniture"
python -m alembic upgrade head
```

Новые изменения схемы: `python -m alembic revision --autogenerate -m "описание"` и снова `upgrade head`.

При прогоне **pytest** таблицы доменных сервисов дополнительно создаются через `metadata.create_all` в `tests/conftest.py` (удобно без ручного запуска Alembic).

---

## Локальный запуск

### 1. Зависимости и переменные

```bash
python -m pip install -r requirements.txt
```

**Windows (PowerShell):**

```powershell
cd путь\к\Furniture
$env:PYTHONPATH = "$PWD"
$env:DATABASE_URL = "postgresql+psycopg2://furniture:furniture@127.0.0.1:5432/furniture"
```

**Linux / macOS:**

```bash
export PYTHONPATH="$(pwd)"
export DATABASE_URL="postgresql+psycopg2://furniture:furniture@127.0.0.1:5432/furniture"
```

### 2. PostgreSQL

Проще всего поднять стенд целиком через **Docker Compose** (см. следующий раздел) или только Postgres: `docker compose up -d postgres` (контейнер `furniture-postgres`, порт `5432`).

При первом создании volume дополнительно создаётся БД **`furniture_test`** для pytest (см. `scripts/postgres/init_test_db.sql`).

### 3. Запуск сервисов (отдельные терминалы)

Каталог, раскрой, планировщик:

```bash
uvicorn services.catalog_service.app.main:app --reload --port 8001
uvicorn services.cutting_service.app.main:app --reload --port 8002
uvicorn services.planner_service.app.main:app --reload --port 8003
```

Auth (обязательно задайте секрет):

```bash
set JWT_SECRET_KEY=dev-change-me-in-prod
set AUTH_BOOTSTRAP_USERNAME=admin
set AUTH_BOOTSTRAP_PASSWORD=change-me
uvicorn services.auth_service.app.main:app --reload --port 8004
```

Assets и gateway:

```bash
uvicorn services.assets_service.app.main:app --reload --port 8005
uvicorn services.gateway_service.app.main:app --reload --port 8080
```

### 4. Документация API

- Напрямую: `http://localhost:8001/docs` … `8005/docs`
- Через gateway (путь = префикс + путь upstream): например `http://localhost:8080/catalog/docs`, `http://localhost:8080/auth/docs`

Заголовок `Authorization` gateway проксирует на бэкенды как есть.

---

## Docker Compose: полный демо-стенд

`docker-compose.yml` поднимает:

| Сервис | Порт с хоста | Назначение |
|--------|----------------|------------|
| `postgres` | 5432 | БД `furniture` (+ init `furniture_test` для pytest) |
| `rabbitmq` | 5672, 15672 | AMQP + веб-консоль управления |
| `minio` | 9000 (S3 API), 9001 (консоль) | Объектное хранилище для `assets_service` |
| `migrate` | — | одноразовый контейнер `alembic upgrade head` (`Dockerfile.migrate`) |
| `minio-init` | — | создание бакета `furniture-assets` |
| `catalog-service` | 8001 | … |
| `cutting-service` | 8002 | … |
| `planner-service` | 8003 | … |
| `auth-service` | 8004 | Bootstrap: `AUTH_BOOTSTRAP_USERNAME=admin`, `AUTH_BOOTSTRAP_PASSWORD=demo123456` |
| `assets-service` | 8005 | `S3_*` указывают на контейнер `minio` |
| `gateway-service` | **8080** | Единая точка входа; CORS для `http://localhost*` / `http://127.0.0.1*` |

Общие для бизнес-сервисов переменные в compose: `JWT_SECRET_KEY=demo_jwt_secret_local_only`, `RABBITMQ_URL=amqp://guest:guest@rabbitmq:5672/`, `DATABASE_URL` на `postgres`.

Gateway внутри сети использует URL вида `http://catalog-service:8000` и т.д. (внутри контейнеров приложения слушают порт **8000**).

Запуск всего стека:

```bash
docker compose up --build -d
```

Если ранее контейнеры создавали таблицы **без Alembic**, применение `001_initial` может завершиться ошибкой «relation already exists». В этом случае сбросьте том PostgreSQL и поднимите заново (данные в БД будут удалены):

```bash
docker compose down -v
docker compose up --build -d
```

Проверки: `GET http://localhost:8080/health`, `GET http://localhost:8080/catalog/health`, Swagger `http://localhost:8080/catalog/docs` и др.

---

## Подготовка к отправке на сервер

В репозитории уже подготовлены серверные шаблоны:

- `docker-compose.server.yml` — отдельный compose для server-deploy с параметрами из env.
- `.env.server.example` — шаблон переменных (секреты, порты, доступы).
- `scripts/deploy/deploy_server.sh` — скрипт проверки/сборки/запуска.

### Быстрый старт (Linux сервер)

```bash
cp .env.server.example .env.server
# заполните .env.server реальными значениями
chmod +x scripts/deploy/deploy_server.sh
./scripts/deploy/deploy_server.sh
```

Проверка после запуска:

```bash
curl http://127.0.0.1:8080/health
```

Если gateway будет за reverse proxy (Nginx/Caddy/Traefik), публикуйте наружу только HTTP(S) прокси и (опционально) админ-порты, а внутренние порты сервисов оставьте внутри сервера.

---

## Тесты

Тесты **только на PostgreSQL** (не SQLite). По умолчанию: БД `furniture_test` на `127.0.0.1:5432`.

```bash
pytest
```

Переопределение URL:

```powershell
$env:TEST_DATABASE_URL = "postgresql+psycopg2://furniture:furniture@localhost:5432/furniture_test"
pytest
```

Если сервер не запущен, pytest завершится с понятным сообщением. Создание БД `furniture_test` при необходимости выполняется в `pytest_sessionstart` (подключение к служебной БД `postgres`).

---

## Краткий чеклист для production

- Задать стойкие `JWT_SECRET_KEY`, пароли БД, не использовать bootstrap в открытом виде.
- Применить **Alembic** вместо опоры только на `create_all` в тестах.
- Настроить **TLS**, лимиты, логирование и health-check’и за reverse proxy.
- Поднять **RabbitMQ** и **MinIO** (или облачный S3 + CDN) и прописать переменные для `common`, `assets_service`, worker’ов.
