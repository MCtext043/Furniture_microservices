# WoodCraft Market / Furniture

Платформа для **онлайн-магазина мебели** и **производственного контура**: каталог, 3D-планировщик комнаты, расчёт раскроя, CRM заказов, админ-панель. Архитектура — **микросервисы на FastAPI** с единым **API Gateway** и статическим фронтендом.

---

## Содержание

1. [Обзор продукта](#обзор-продукта)
2. [Функционал](#функционал)
3. [Фронтенд](#фронтенд)
4. [Форматы экспорта (DBS, GLTF, Базис)](#форматы-экспорта)
5. [Архитектура](#архитектура)
6. [Стек технологий](#стек-технологий)
7. [Структура репозитория](#структура-репозитория)
8. [Быстрый старт (Docker)](#быстрый-старт-docker)
9. [Деплой на сервер](#деплой-на-сервер)
10. [API и авторизация](#api-и-авторизация)
11. [База данных и миграции](#база-данных-и-миграции)
12. [Тесты](#тесты)

---

## Обзор продукта

| Роль | URL (локально) | Назначение |
|------|----------------|------------|
| **Покупатель** | http://127.0.0.1:8080/ | Каталог, корзина, доставка, 3D-планировщик, оценка стоимости |
| **Администратор** | http://127.0.0.1:8080/admin.html | Каталог CRUD, раскрой, CRM, настройки доставки, производство |
| **API / Swagger** | http://127.0.0.1:8080/catalog/docs | REST через gateway |

**Локальный вход admin:** `admin` / `demo123456`  
**На сервере:** пароль из `deploy/local.env` (`AUTH_BOOTSTRAP_PASSWORD`)

---

## Функционал

### Витрина (пользователь)

- Каталог товаров: категории, поиск, фильтры, карточки с ценой и остатком.
- Корзина и избранное (JWT).
- **Доставка:** расчёт по адресу (геокодинг Nominatim), порог бесплатной доставки.
- **3D-планировщик:** размеры комнаты, расстановка модулей мебели, план сверху с поворотом, BOM и ориентировочная стоимость.
- Экспорт: **GLTF**, **DBS**, PDF-инструкция.

### Админ-панель

- CRUD каталога (категории, товары, демо-данные).
- **CRM производства:** заказы на изготовление, склад материалов, расчёт «что докупить» по каждому заказу.
- **Раскрой листового материала** (MaxRects, поворот деталей 90°), история задач, PDF-карта.
- **3D для производства:** те же сцены + экспорт в **Базис** (JS-скрипт), **DBS**, **GLTF**.
- Настройки доставки (порог, тариф ₽/км, адрес склада).
- MinIO: presigned URL для загрузки 3D-моделей.

### Backend-сервисы

| Сервис | Префикс gateway | Ответственность |
|--------|-----------------|-----------------|
| `catalog_service` | `/catalog` | Товары, корзина, доставка, **CRM** |
| `cutting_service` | `/cutting` | Оптимизация раскроя, `/jobs` |
| `planner_service` | `/planner` | Проекты комнат, расстановка |
| `auth_service` | `/auth` | JWT, регистрация, RBAC |
| `assets_service` | `/assets` | S3/MinIO presigned PUT/GET |
| `gateway_service` | `/` | Прокси + статика `frontend/` |

---

## Фронтенд

```
frontend/
├── index.html      # витрина (APP_MODE=user)
├── admin.html      # админка (APP_MODE=admin)
├── app.js          # общая логика
├── textures3d.js   # PBR-процедурные текстуры для Three.js
└── styles.css
```

### 3D-планировщик и текстуры

Визуализация на **Three.js** (WebGL). Текстуры генерируются процедурно в `textures3d.js`:

- **PBR:** color map + normal map, roughness/metalness.
- **Материалы:** дуб (светлый/тёмный), МДФ, ДСП, ламинат, столешница, ткань, металл.
- **Комната:** паркетный пол, штукатурные стены, мягкие тени, tone mapping (ACES).

Подход схож с профессиональными конструкторами вроде [КонструкторКухни.ру](https://konstruktorkuhni.ru): отдельные материалы для фасадов/корпуса/пола, orbit-камера (ЛКМ — поворот, колёсико — zoom).

**Управление камерой:** зажать ЛКМ на 3D-сцене и двигать мышь; колёсико — приближение.

---

## Форматы экспорта

| Формат | Кнопка | Описание |
|--------|--------|----------|
| **DBS** | `DBS` | JSON-файл `.dbs` — *Design Bundle Specification*: комната, мебель, BOM, панели, раскрой, оценка стоимости. Для передачи в производство/CRM. |
| **GLTF** | `GLTF` / «Скачать 3D» | 3D-сцена для Blender, Sketchfab и т.д. |
| **Базис** | `Базис` | JS-скрипт для **БАЗИС-Мебельщик** (панели, фасады). Запуск: Скрипты → выбрать файл. |
| **PDF** | «Инструкция», «PDF карта раскроя» | Сборка и раскрой через pdfmake. |

### Структура DBS (v1.0)

```json
{
  "format": "woodcraft-dbs",
  "version": "1.0",
  "room": { "width": 6000, "length": 5000, "height": 2800 },
  "furniture": [ { "name": "...", "type": "wardrobe", "width_mm": 1400, ... } ],
  "bom": { "parts": [...], "assembly": [...], "estimated_cost_rub": 125000 },
  "panels": [ { "name": "Боковина", "width_mm": 600, "height_mm": 2200, "quantity": 2 } ],
  "cutting": { "total_sheets": 3, "utilization_percent": 78.5 }
}
```

> DBS — открытый JSON-контейнер проекта WoodCraft, не путать с проприетарным `.b3d` Базиса. Для полного импорта в Базис используйте экспорт **Базис (JS)**.

---

## Архитектура

```mermaid
flowchart TB
  subgraph client [Клиент]
    UI[index.html / admin.html]
  end

  subgraph gateway [Gateway :8080]
    GW[FastAPI + StaticFiles]
  end

  subgraph services [Микросервисы]
    CAT[catalog :8001]
    CUT[cutting :8002]
    PLN[planner :8003]
    AUTH[auth :8004]
    AST[assets :8005]
  end

  subgraph infra [Инфраструктура]
    PG[(PostgreSQL 16)]
    RMQ[(RabbitMQ)]
    S3[(MinIO S3)]
  end

  UI --> GW
  GW --> CAT & CUT & PLN & AUTH & AST
  CAT & CUT & PLN & AUTH --> PG
  CAT & CUT & PLN -.-> RMQ
  AST --> S3
```

### Принципы

- **Единая точка входа** — клиент ходит только на gateway.
- **Доменное разделение** — каталог, раскрой, планировщик изолированы.
- **Общая БД** — одна PostgreSQL, схемы через Alembic.
- **JWT + RBAC** — роли `catalog:write`, `cutting:run`, `planner:write`, `assets:write`, `admin`.
- **События** — RabbitMQ topic `furniture.events` (опционально).

---

## Стек технологий

### Backend

| Компонент | Технология |
|-----------|------------|
| Язык | Python 3.12 |
| API | FastAPI, Uvicorn, Pydantic v2 |
| ORM | SQLAlchemy 2 |
| Миграции | Alembic |
| Auth | PyJWT, passlib (bcrypt) |
| Очереди | Pika → RabbitMQ |
| Файлы | boto3 → MinIO (S3 API) |
| Тесты | pytest, httpx |

### Frontend

| Компонент | Технология |
|-----------|------------|
| UI | HTML5, Bootstrap 5 |
| 3D | Three.js r160, процедурные PBR-текстуры |
| PDF | pdfmake |
| API | fetch + JWT в localStorage |

### DevOps

| Компонент | Технология |
|-----------|------------|
| Контейнеры | Docker, Docker Compose |
| Деплой | PowerShell + SSH (`deploy/upload-to-server.ps1`) |
| CI-ready | pytest на PostgreSQL |

---

## Структура репозитория

```
Furniture/
├── common/                    # jwt_auth, messaging
├── services/
│   ├── catalog_service/       # каталог, CRM, доставка
│   ├── cutting_service/       # MaxRects раскрой
│   ├── planner_service/
│   ├── auth_service/
│   ├── gateway_service/       # прокси + frontend
│   └── assets_service/
├── frontend/                  # SPA (index + admin)
├── alembic/versions/          # 001_initial, 002_delivery, 003_crm
├── deploy/                    # скрипты деплоя, local.env
├── docker-compose.yml         # локальный стенд
├── docker-compose.server.yml  # VPS
├── Dockerfile.migrate
├── tests/
└── workers/                   # пример RabbitMQ consumer
```

---

## Быстрый старт (Docker)

```powershell
cd Furniture
docker compose up --build -d
```

| Сервис | Порт |
|--------|------|
| Gateway + UI | **8080** |
| catalog | 8001 |
| cutting | 8002 |
| planner | 8003 |
| auth | 8004 |
| assets | 8005 |
| PostgreSQL | 5432 |
| MinIO console | 9001 |

Проверка:

```powershell
curl http://127.0.0.1:8080/health
```

Обновление после изменений фронта:

```powershell
docker compose up -d --build gateway-service
```

---

## Деплой на сервер

1. Скопировать `deploy/local.env.example` → `deploy/local.env`, задать пароли.
2. Выполнить:

```powershell
powershell -ExecutionPolicy Bypass -File deploy\upload-to-server.ps1
```

| Режим | Команда |
|-------|---------|
| Полный деплой | `upload-to-server.ps1` |
| Только фронт | `upload-to-server.ps1 -Fast` |
| Сброс БД | `upload-to-server.ps1 -ResetDb` |

**Production URL:** `http://<PUBLIC_HOST>:8002/` (порт из `GATEWAY_PORT` в `local.env`).

Диагностика на сервере: `bash deploy/diagnose-server.sh`

---

## API и авторизация

### Получение токена

```http
POST /auth/token
Content-Type: application/json

{"username": "admin", "password": "..."}
```

Ответ: `{ "access_token": "...", "expires_in": 7200 }`

### Заголовок

```http
Authorization: Bearer <token>
```

### Ключевые маршруты

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/catalog/products` | Список товаров |
| POST | `/catalog/products` | Создать товар (admin) |
| GET | `/catalog/crm/orders` | Заказы CRM |
| GET | `/catalog/crm/orders/{id}/procurement` | Расчёт закупки |
| POST | `/catalog/crm/seed-demo` | Демо CRM |
| POST | `/cutting/optimize` | Раскрой |
| POST | `/assets/presign-put` | URL загрузки в MinIO |

Полная документация: `/catalog/docs`, `/cutting/docs`, … через gateway.

### RBAC

| Роль | Права |
|------|-------|
| `user` | Корзина, планировщик (чтение/свои проекты) |
| `catalog:write` | CRUD каталога, CRM |
| `cutting:run` | Расчёт раскроя |
| `planner:write` | Сохранение проектов |
| `assets:write` | Загрузка 3D в MinIO |
| `admin` | Все права |

---

## База данных и миграции

Единая БД `furniture`. Миграции Alembic:

| Ревизия | Содержание |
|---------|------------|
| `001_initial` | Каталог, auth, cutting, planner |
| `002_delivery` | Настройки доставки |
| `003_crm` | CRM: материалы, склад, заказы |

Локально (миграции через Docker):

```powershell
docker compose run --rm migrate
```

Или:

```powershell
$env:DATABASE_URL = "postgresql+psycopg2://furniture:furniture@127.0.0.1:5432/furniture"
python -m alembic upgrade head
```

---

## Тесты

```powershell
$env:PYTHONPATH = "$PWD"
$env:TEST_DATABASE_URL = "postgresql+psycopg2://furniture:furniture@127.0.0.1:5432/furniture_test"
pytest
```

---

## Переменные окружения (кратко)

| Переменная | Назначение |
|------------|------------|
| `DATABASE_URL` | PostgreSQL для всех сервисов |
| `JWT_SECRET_KEY` | Секрет JWT (обязателен в prod) |
| `AUTH_BOOTSTRAP_*` | Создание admin при старте auth |
| `GATEWAY_*_URL` | URL upstream-сервисов для gateway |
| `S3_*` | MinIO / S3 для assets |
| `RABBITMQ_URL` | Очередь событий (опционально) |

Примеры: `deploy/local.env.example`, `deploy/server.env.sample`.

---

## Лицензия и контакты

Внутренний проект WoodCraft Market. Вопросы по деплою — см. `deploy/` и историю коммитов.
