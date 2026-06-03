# Вход по email и SMTP

Приложение **не отправляет письма само**. В режиме `VITE_DATA_MODE=appwrite` код запрашивается через Appwrite:

```ts
account.createEmailToken({ userId, email })
```

Письмо с OTP отправляет **сервер Appwrite** (контейнер `appwrite-worker-mails`), если у него настроен SMTP.

## Почему переменные в `.env` этого репозитория не работают

В корневом `.env` проекта Event Gallery лежат только переменные с префиксом `VITE_*` — их читает Vite/браузер.

Переменные вида `_APP_SMTP_HOST`, `_APP_SMTP_PASSWORD` и т.д. — это **настройки Docker-установки Appwrite**. Они должны быть в `.env` **там, где запущен Appwrite** (каталог с `docker-compose.yml` Appwrite), а не во фронтенде.

Пока SMTP не прописан в Appwrite и контейнеры не перезапущены, письма не придут, даже если `_APP_SMTP_*` есть в `.env` дипломного проекта.

## Что сделать

### 1. Настроить SMTP в Appwrite

Откройте `.env` в папке установки Appwrite (не этот репозиторий) и добавьте, например для Gmail / Yandex / Mail.ru:

```env
_APP_SMTP_HOST=smtp.gmail.com
_APP_SMTP_PORT=587
_APP_SMTP_SECURE=tls
_APP_SMTP_USERNAME=your@gmail.com
_APP_SMTP_PASSWORD=app-password-or-token
_APP_SYSTEM_EMAIL_ADDRESS=your@gmail.com
_APP_SYSTEM_EMAIL_NAME=Event Gallery
```

- Для Gmail нужен **пароль приложения**, не обычный пароль аккаунта.
- `_APP_SYSTEM_EMAIL_ADDRESS` должен совпадать с разрешённым отправителем у провайдера.
- Порт `465` → обычно `_APP_SMTP_SECURE=ssl`.

Перезапустите Appwrite:

```bash
docker compose up -d --force-recreate
```

### 2. Проверить логи почты

```bash
docker compose logs -f appwrite-worker-mails
```

После «Получить код» в приложении в логах не должно быть ошибок SMTP / authentication.

### 3. Включить Email OTP в Console

Appwrite Console → ваш проект → **Auth** → методы входа:

- включить **Email** / Magic URL / OTP (название зависит от версии);
- при необходимости добавить домен приложения в разрешённые redirect/origin.

### 4. Переменные фронтенда (этот репозиторий)

В `.env` диплома нужны только:

```env
VITE_DATA_MODE=appwrite
VITE_APPWRITE_ENDPOINT=...
VITE_APPWRITE_PROJECT_ID=...
```

SMTP сюда **не** добавляют (пароль попал бы в сборку фронтенда — это небезопасно).

## Режим `local` без Appwrite

При `VITE_DATA_MODE=local` письма не отправляются. Для проверки UI используйте код **`000000`**.

## Локально на Windows: Gmail часто недоступен

Ошибка `Could not connect to SMTP host` при `smtp.gmail.com:587` часто значит, что **провайдер или сеть блокируют исходящий SMTP** (порты 587 и 465). Проверка с ПК:

```powershell
Test-NetConnection smtp.gmail.com -Port 587
```

Если `TcpTestSucceeded : False` — с Docker до Gmail тоже не достучаться.

**Решение для разработки:** локальный [Mailpit](https://github.com/axllent/mailpit) в одной сети с Appwrite:

1. `docker-compose.override.yml` в папке Appwrite с сервисом `mailpit` (см. `appwrite-local` на рабочем столе). Обязательно:

```yaml
environment:
  MP_SMTP_DISABLE_RDNS: 'true'
```

Без этого на Windows/Docker Mailpit может **~10 секунд** делать reverse DNS по IP контейнера `appwrite-worker-mails`, и Appwrite получит в логах `MAIL FROM command failed … 421 4.4.2` — письмо не уйдёт, хотя Mailpit запущен.

2. В `.env` Appwrite (в начале файла **не** оставляйте старый `noreply@appwrite.io` — дубли перезаписывают настройки):

```env
_APP_SMTP_HOST=mailpit
_APP_SMTP_PORT=1025
_APP_SMTP_SECURE=
_APP_SMTP_USERNAME=
_APP_SMTP_PASSWORD=
_APP_SYSTEM_EMAIL_ADDRESS=noreply@local.test
```

3. `docker compose up -d --force-recreate appwrite-worker-mails`
4. Коды смотреть в **http://localhost:8025** (входящие письма), не в Gmail.

## Ошибка 429 (Too Many Requests)

Appwrite ограничивает частоту запросов `POST /v1/account/tokens/email` (обычно после многих нажатий «Получить код» подряд).

Что делать:

1. Подождите **1–2 минуты** (иногда до 15 минут на cloud).
2. Откройте **http://localhost:8025** (Mailpit) — код мог уже быть в более раннем письме.
3. Не жмите «Получить код» и «Создать профиль» много раз подряд — приложение теперь не шлёт повторный запрос чаще чем раз в минуту, если код уже запрошен.
4. На self-hosted Appwrite лимиты можно ослабить в `.env` сервера (см. документацию Appwrite по rate limits / `_APP_OPTIONS_ABUSE`).

## Если код не приходит, но ошибки в UI нет

Значит `createEmailToken` прошёл, а воркер почты Appwrite не смог отправить письмо. Смотрите `appwrite-worker-mails` и настройки `_APP_SMTP_*` в **Appwrite** `.env`.

Типичная ошибка в логах:

```text
MAIL FROM command failed … closing transmission channel after timeout exceeded
```

→ пересоздайте Mailpit с `MP_SMTP_DISABLE_RDNS=true` и `docker compose up -d --force-recreate mailpit appwrite-worker-mails`, затем снова «Получить код» и откройте **http://localhost:8025**.
