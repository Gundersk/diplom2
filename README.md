# Event Gallery

Дипломный веб-проект: приватные события с приглашениями по ссылке, общим фотоальбомом, RSVP, чатом и достижениями.

**Стек:** Vue 3, TypeScript, Vite. Данные — **два режима** на одном коде: локальный (`local`) и серверный через Appwrite (`appwrite`).

---

## Быстрый старт

```bash
npm install
cp .env.example .env
npm run dev
```

Приложение откроется на [http://localhost:5180](http://localhost:5180) (порт задан в `vite.config.ts`).

По умолчанию в `.env.example` стоит `VITE_DATA_MODE=local` — можно сразу работать без Docker и Appwrite.

---

## Два режима данных

Переключатель: переменная `VITE_DATA_MODE` в `.env`. Читается в `src/config/runtime.ts`, ветвление сервисов — `src/services/adapters/dataMode.ts` (`isLocalMode()` / `isAppwriteMode()`).

| | **local** | **appwrite** |
|---|-----------|--------------|
| **Назначение** | Демо, разработка UI, защита без сервера | Multi-user, общие данные между браузерами |
| **Пользователи** | Demo-гость в localStorage; вход по email с кодом `000000` | Anonymous session (гость) или email OTP через Appwrite Auth |
| **События** | `localStorage` (`event-gallery.home-events`) | Коллекция `events` + локальный кэш UI |
| **Участники** | localStorage | Коллекция `participants` |
| **Альбом события** | localStorage + IndexedDB (`idb://…`) для файлов | Коллекция `photos` + Appwrite Storage |
| **Чат** | localStorage | Коллекция `chat_messages` |
| **RSVP** | localStorage | Коллекция `rsvps` |
| **Достижения события и награды** | localStorage | `event_achievements`, `participant_achievements` |
| **Шаблоны достижений (кастомные)** | localStorage (в обоих режимах) | localStorage (в обоих режимах) |
| **«Сохранённые» фото (личная галерея)** | localStorage | localStorage (пока не в Appwrite) |
| **Обложка / фон / аватар** | blob в IndexedDB | Appwrite Storage (`event_gallery_photos`) |

### Важно про гибрид в appwrite mode

Даже при `VITE_DATA_MODE=appwrite` часть UI-состояния дублируется в `localStorage` (список «Мои события», счётчики, overlay при загрузке). Это осознанный кэш: `eventService` подмешивает его к документам Appwrite. Подробнее — `docs/appwrite-event-audit.md` (архивный аудит с пометкой об исправлениях).

---

## Что умеет приложение

- **Home** — карточки событий (текущие / будущие / прошедшие), личная лента сохранённых фото, профиль.
- **Создание события** — дата, RSVP-стили, пресеты обложек/фонов (`src/assets/event-presets/`), достижения, оплата (реквизиты без реальных платежей).
- **Страница события** — детали, RSVP, альбом, чат, выдача достижений организатором.
- **Приглашения** — `?event=КОД` (организатор) или `?eventId=…` (гость); логика в `useInviteFlow` и `eventInviteNavigation.ts`.
- **Гость → профиль** — слияние данных (`guestMergeService`): события, участия, сохранённые фото, достижения.

### Participant и RSVP

- **participant** — пользователь вошёл в контекст события (доступ к альбому и чату).
- **RSVP** — отдельный ответ: «пойду» / «возможно» / «не смогу».
- Отказ **не удаляет** запись participant.

---

## Настройка режима local

1. В `.env`: `VITE_DATA_MODE=local`.
2. `npm run dev`.
3. При первом заходе создаётся demo-пользователь (`authService.createDemoUser`).
4. Для проверки входа по email в UI используйте код **`000000`** (письма не отправляются).

Медиафайлы (обложки, фото) хранятся в IndexedDB; ссылки вида `idb://event-gallery/…` резолвятся в `localBlobStorage.ts`.

---

## Настройка режима appwrite

### 1. Переменные фронтенда

Скопируйте `.env.example` → `.env` и укажите:

```env
VITE_DATA_MODE=appwrite
VITE_APPWRITE_ENDPOINT=http://localhost/v1
VITE_APPWRITE_PROJECT_ID=…
VITE_APPWRITE_DATABASE_ID=…
VITE_APPWRITE_BUCKET_ID=event_gallery_photos
```

Секреты и API-ключи **не** кладутся в `.env` фронтенда.

### 2. Схема на сервере

```bash
cp .env.setup.example .env.setup
# заполнить APPWRITE_* и APPWRITE_API_KEY
npm run setup:appwrite
```

Скрипт идемпотентный: создаёт коллекции, индексы и бакет по `docs/appwrite-schema.md`. Файл `.env.setup` в git не попадает.

### 3. SMTP для OTP

Письма с кодом отправляет **сервер Appwrite**, не Vue. Настройка SMTP — в `.env` Docker-установки Appwrite. Инструкция: `docs/email-otp-setup.md`.

### 4. Проверка multi-user

1. Запустить приложение с `VITE_DATA_MODE=appwrite`.
2. В первом браузере создать событие, скопировать invite-ссылку.
3. Открыть ссылку в инкогнито, войти как гость.
4. Отправить сообщение в чат и загрузить фото в альбом.
5. У организатора после обновления страницы должны быть видны гость, сообщение и фото.
6. В Appwrite Console — новые документы в `participants`, `chat_messages`, `photos`.

### 5. Починка прав организатора

После миграции гостя в профиль иногда нужно:

```bash
npm run repair:organizer
```

---

## Слой сервисов

Каждый файл в `src/services/` ветвится по `isAppwriteMode()`:

| Сервис | Роль |
|--------|------|
| `authService` | Demo / guest / profile, коллекция `profiles` |
| `eventService` | CRUD событий, invite-код, кэш home |
| `participantService` | Участники, роли, очки |
| `photoService` | Альбом события |
| `chatService` | Чат |
| `rsvpService` | Ответы гостей |
| `achievementService` | Достижения и награды (шаблоны — в localStorage) |
| `automaticAchievementService` | Авто-награда «Первый кадр» |
| `savedPhotoService` | Только localStorage |
| `storageService` | Загрузка в Appwrite Storage (appwrite mode) |
| `guestMergeService` | Слияние гостевой сессии с профилем |

Схема коллекций: `src/config/appwriteSchema.ts`.

---

## Структура фронтенда

После рефакторинга (фазы 1–4) UI разбит на модули:

```
src/
  App.vue                 # роутинг: home | create | event | preview
  composables/
    useEventGalleryApp.ts # основная логика приложения
    useCreateEventForm.ts # форма создания/редактирования
    useInviteFlow.ts      # вход по invite / eventId
    eventGalleryContext.ts
  views/                  # HomeView, CreateEventView, EventPageView
  components/             # AuthDialog, PhotoViewer, RsvpSheet, …
  services/               # слой данных (local / appwrite)
  assets/event-presets/   # пресеты обложек и фонов
```

Дочерние компоненты получают состояние через `useEventGallery()` (provide/inject), без prop drilling из `App.vue`.

---

## Скрипты npm

| Команда | Описание |
|---------|----------|
| `npm run dev` | Dev-сервер (порт 5180) |
| `npm run build` | Проверка типов + production-сборка |
| `npm run preview` | Просмотр сборки |
| `npm run setup:appwrite` | Создание схемы Appwrite |
| `npm run repair:organizer` | Починка прав organizer/owner |

Полный список — в `Команды.txt`.

---

## Документация

| Файл | Зачем читать |
|------|----------------|
| [docs/development-log.md](docs/development-log.md) | Журнал шагов для защиты |
| [docs/appwrite-schema.md](docs/appwrite-schema.md) | Поля коллекций и бакетов |
| [docs/email-otp-setup.md](docs/email-otp-setup.md) | SMTP и вход по email |
| [docs/home-gallery-product-decisions.md](docs/home-gallery-product-decisions.md) | Продуктовые решения Home и галереи |
| [docs/appwrite-event-audit.md](docs/appwrite-event-audit.md) | Аудит персистентности (архив) |

---

## Ограничения текущей версии

- Личная галерея «сохранённых» фото не синхронизируется между браузерами в appwrite mode.
- Кастомные шаблоны достижений хранятся в localStorage даже при Appwrite.
- Комментарии к фото в UI сняты; при удалении фото чистится legacy-ключ в localStorage.
- `VITE_DATABASE_URL` в `.env` — задел под будущий SQL backend, фронтенд его не использует.
