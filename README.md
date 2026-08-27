# EdGGe

Telegram Mini App для поиска тиммейтов в Dota 2.

## Обязательная настройка Vercel

Сборка не требует подключения к базе данных, но без неё приложение не сможет
создавать анкеты, сохранять лайки и мэтчи. В **Project → Settings → Environment
Variables** добавьте хотя бы одну строку подключения:

- `DATABASE_URL` — рекомендуемый вариант;
- либо `POSTGRES_URL` / `POSTGRES_URL_NON_POOLING`, если проект подключён через
  Vercel Postgres или Neon.

После добавления переменных (и редеплоя) примените схему к этой базе.

**Способ 1 — без CLI, прямо на задеплоенном приложении (рекомендуется):**

```bash
curl 'https://<your-domain>/api/admin/migrate?secret=<BOT_SETUP_SECRET>'
# или заголовком: -H 'x-setup-secret: <BOT_SETUP_SECRET>'
```

Эндпоинт идемпотентен: уже применённые миграции пропускаются. Если
`BOT_SETUP_SECRET` не задан, секрет не требуется. SQL миграций зашит в
`src/db/migrations.ts`, поэтому на Vercel не нужен доступ к ФС.

**Способ 2 — из локальной среды с доступом к базе:**

```bash
DATABASE_URL='postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require' npm run db:push
```

> Для Neon в миграциях используйте **Direct connection** (хост без `-pooler`),
> для Vercel Postgres — `POSTGRES_URL_NON_POOLING`.

Проверить подключение после деплоя можно по адресу:

```text
https://<your-domain>/api/health
```

Успешный ответ содержит `{"ok":true,"database":"connected"}`. Если база не
настроена, endpoint вернёт понятный статус `503` и название требуемых переменных.

## Публичный доступ для Telegram

URL, указанный в `APP_URL`, должен быть доступен **без Vercel Login / Deployment
Protection**. Telegram WebView не сможет пройти экран Vercel SSO, поэтому в
**Project → Settings → Deployment Protection** отключите защиту для production
(и для preview, если используете preview URL в боте), либо используйте публичный
production-домен. Не указывайте в боте защищённый preview URL.

## Telegram production-настройки

Добавьте в Vercel следующие переменные:

```text
TELEGRAM_BOT_TOKEN=<токен бота>
TELEGRAM_BOT_USERNAME=<username бота без @>
NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=<тот же username>
APP_URL=https://<your-domain>
TELEGRAM_WEBHOOK_SECRET=<случайная длинная строка>
```

После первого production-деплоя зарегистрируйте webhook и кнопку Mini App:

```bash
curl -H 'x-setup-secret: <BOT_SETUP_SECRET>' \
  'https://<your-domain>/api/bot/setup'
```

Если `BOT_SETUP_SECRET` не задан, заголовок не требуется. Дополнительные
переменные, включая параметры админ-панели, перечислены в `.env.example`.

## Локальный запуск

```bash
cp .env.example .env.local
# заполните DATABASE_URL и при необходимости Telegram-переменные
npm ci
npm run db:push
npm run dev
```

Без `TELEGRAM_BOT_TOKEN` сервер использует демо-режим. С `TELEGRAM_BOT_TOKEN`
приложение нужно открывать именно из Telegram Mini App, чтобы Telegram передал
подписанные `initData`.
