# Woodcraft React

Новый вариант интерфейса изолирован от legacy-фронтенда в `frontend/`.

## Docker

Из корня проекта:

```powershell
docker-compose -f docker-compose.yml -f docker-compose.react.yml up -d --build
```

Новый интерфейс: `http://127.0.0.1:5173/`. Старый интерфейс продолжает работать на `http://127.0.0.1:8080/`.

## Локальная разработка

```powershell
cd frontend-react
pnpm install
pnpm dev
```

Vite проксирует `/api` на gateway по адресу `http://127.0.0.1:8080`.

## Проверки

```powershell
pnpm lint
pnpm test
pnpm build
pnpm test:e2e
```
