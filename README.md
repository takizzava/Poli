# Poli / edi-react-pg

> React + Vite frontend and Express/Postgres backend for reminders, push and TTS — lightweight starter used in this workspace.

## Описание

Этот репозиторий содержит одностраничное приложение на React (Vite) и небольшой сервер на Node.js/Express с PostgreSQL в качестве хранилища. Включены маршруты для аутентификации, напоминаний, push-уведомлений и простого AI/ TTS API.

Структура проекта (важные папки):

- `src/` — React клиент (Vite)
- `server/` — Express API и скрипты для работы с БД
- `public/` — статические ресурсы и PWA-манифест

## Быстрый старт (локально)

Требования:
- Node.js (LTS) и npm
- PostgreSQL (локальный или managed)

1) Клонируйте репозиторий:

```powershell
git clone https://github.com/takizzava/Poli.git
cd Poli
```

2) Установите зависимости:

```powershell
npm install
```

Во время установки автоматически запускается `postinstall` скрипт, который выполнит миграции/создание таблиц (см. `server/scripts/init-db.js`). Если нужно, можно выполнить его вручную:

```powershell
node server/scripts/init-db.js
```

3) Создайте файл окружения `.env` в корне (пример ниже) и заполните значениями.

Пример `.env`:

```
# URL подключения к Postgres
DATABASE_URL=postgres://user:pass@localhost:5432/yourdb

# Разрешить SSL для подключения к БД (useful for cloud providers)
PGSSL=0

# Секрет для подписи JWT (меняйте в проде)
JWT_SECRET=change-me

# Порт для сервера
PORT=8080

# Origin'ы, которым разрешён CORS (список через запятую)
CORS_ORIGINS=http://localhost:5173

# NODE_ENV=development
```

4) Запустите приложение в режиме разработки (одной командой):

```powershell
npm run dev
```

Это запустит клиент (`vite`) и сервер (`nodemon server/index.js`) параллельно. Вы также можете запускать их по-отдельности:

```powershell
npm run dev:client   # только фронтенд (Vite)
npm run dev:server   # только API сервер
```

5) Собрать и запустить production-версию:

```powershell
npm run build
npm start
```

Команда `npm run build` соберёт фронтенд и скопирует `dist` в `server/public`, затем `npm start` запустит сервер, который будет отдавать статику.

## Переменные окружения

- `DATABASE_URL` — строка подключения к PostgreSQL
- `PGSSL` — `1`/`true` если нужно включить SSL (по умолчанию SSL отключён для локального DB)
- `JWT_SECRET` — секрет для подписи JWT токенов
- `PORT` — порт для сервера
- `CORS_ORIGINS` — список origin'ов, разделённых запятой

## Структура API (кратко)

- `POST /api/signup` — регистрация
- `POST /api/login` — логин
- `POST /api/logout` — выход
- `GET /api/me` — данные текущего пользователя (по cookie)
- `POST /api/reminders` и др. — CRUD для напоминаний (см. `server/routes/reminders.js`)
- `POST /api/push` — регистрация push-подписок
- `POST /api/ai` и `POST /api/tts` — экспериментальные маршруты для AI/TTS

Для подробностей см. исходники в `server/routes/`.

## Инициализация БД

Скрипт `server/scripts/init-db.js` создаёт необходимые таблицы (`users`, `reminders`, `subscriptions`). Он запускается автоматически после `npm install`, но вы всегда можете запустить его вручную:

```powershell
node server/scripts/init-db.js
```

Если у вас кластер или хостинг БД с SSL, установите `PGSSL=1` и передайте корректный `DATABASE_URL`.

## Разработка и тестирование

- Для быстрой разработки используйте `npm run dev`.
- Код сервера использует ES модули (флаг `type: module` в `package.json`).

## Важные заметки

- Cookies для сессий устанавливаются с флагом `secure` только в `production`.
- JWT секрет по умолчанию — `dev-secret`. Не используйте его в реальной среде.
- По умолчанию в коде предусмотрена простая политика CORS, её можно изменить через `CORS_ORIGINS`.

## Контрибуция

Если хотите помочь — создайте issue или pull request. Опишите, что вы хотите изменить, и подключите тестовый сценарий.

## License

Лицензия: по желанию — добавьте `LICENSE` файл или настройте подходящую лицензию.

---

Если хотите, могу добавить в README секцию с примерами API-запросов (`curl`/fetch) или подробную инструкцию по деплою на Heroku/Vercel/Render. Напишите, что предпочитаете.

## Расширение для браузера (локальная разработка)

В репозитории есть простое расширение в папке `extension/`. Оно содержит popup и background (service worker), который выполняет запросы к серверу без Origin-заголовка — это облегчает работу с cookie-сессиями.

Как установить локально (Chromium-based браузеры):

1. Убедитесь, что сервер запущен (`npm run dev` или `npm start`).
2. Откройте `chrome://extensions/` (или `edge://extensions/`).
3. Включите `Developer mode` и нажмите `Load unpacked`.
4. Выберите папку `extension/` в корне репозитория.

Как пользоваться:
- Откройте popup расширения — в поле `API URL` укажите адрес сервера (по умолчанию `http://localhost:8080`) и нажмите `Сохранить`.
- Воспользуйтесь формой логина — background выполнит запросы к `/api/login` и сохранит cookie с сервера.
- После авторизации можно получить `GET /api/me` и `GET /api/reminders`, а также создать тестовое напоминание.

Замечания:
- Расширение использует background fetch (service worker) чтобы отправлять запросы без Origin. Сервер в текущей конфигурации разрешает такие запросы (см. `server/index.js`).
- Если ваш сервер находится на другом хосте, добавьте соответствующий URL в `extension/manifest.json` в `host_permissions`.

