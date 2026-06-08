# Аудит персистентности событий в Appwrite

**Дата:** 2026-05-21  
**Статус:** архивный снимок. Часть проблем закрыта в последующих коммитах (см. блок «Обновление» в конце). Актуальное состояние — `README.md` и `docs/appwrite-schema.md`.

**Файлы на момент аудита:** `eventService.ts`, `photoService.ts`, `participantService.ts`, `rsvpService.ts`, `App.vue`, `types/event.ts`.

**Цель:** понять, что реально уходит в Appwrite, что остаётся только в браузере и почему организатор и гость видят разное оформление события.

## 1. Какие поля формы пишутся в коллекцию `events`

Сборка payload: `toAppwriteEventPayload(...)` в `eventService.ts`.

Пишутся в `events`:

- `title`, `description`, `startsAt`, `endsAt`, `timezone`, `location`
- `organizerId`, `inviteCode`
- `coverUrl`, `themeColor`
- `guestsCanInvite`, `maxParticipants`
- `isPaid`, `costPerPerson`, `paymentDetails`, `paymentComment`
- `createdAt`, `updatedAt`

Заметки:

- `coverUrl` берётся из `coverStart`, если это не цвет.
- `themeColor` — сжатый fallback фона/акцента, не полное описание фона.

## 2. Что на момент аудита терялось в Appwrite mode

Поля есть в UI/модели, но **не** попадали в документ `events`:

- `organizerName`, `organizerInitials`, `organizerTone`, `organizerAvatarSrc`
- `coverEnd`, `backgroundStart`, `backgroundEnd`, `accent`
- `backgroundMode`, `backgroundAssetId`, `backgroundColor`, `coverAssetId`
- `titleStyle`, `rsvpStyle`, `infoBlocks`

Отдельно не шарились через backend:

- достижения из формы создания;
- фото альбома, чат, список RSVP (жили в local-сервисах).

## 3. Восстановление из local-кэша

Документа Appwrite недостаточно для полного UI. `fromAppwriteEventDocument(...)` и `mergeEventWithCachedUiState(...)` подмешивают:

- имя/аватар организатора, стили, блоки info;
- `achievements`, `photos`, `chatMessages`, `guestRsvps`, счётчики.

Организатор после создания видел «полное» событие из кэша `event-gallery.home-events`; гость — только то, что восстановилось из документа и своих fallback.

## 4. Почему обложка/фон не совпадали у гостя

### 4.1 `blob:` URL в браузере

Загрузка обложки/фона через `URL.createObjectURL(file)` давала локальный `blob:` — недоступный другому браузеру.

### 4.2 Фон не попадал в payload

В `toAppwriteEventPayload` уходили `coverUrl` и `themeColor`, но не `backgroundStart`, `backgroundMode` и т.д.

### 4.3 Иллюзия у организатора

`createEvent` / `updateEvent` сохраняли полный объект в local-кэш — текущий браузер маскировал дыры backend.

## 5. Минимальная схема без Storage (рекомендация аудита)

Для MVP без Storage:

- только пресеты из `src/assets/event-presets/` и цветовые темы;
- persist: `backgroundMode`, `backgroundAssetId` / `backgroundColor`, `accent`, `titleStyle`, `rsvpStyle`, `infoBlocksJson`.

Пользовательские upload без Storage — ненадёжны.

## 6. Что без Appwrite Storage не сделать нормально

- Свои обложки/фоны/GIF/video между браузерами.
- Base64 в строках БД — слабое решение (размер, производительность).

## 7. Создавать ли participant при входе по invite

**На момент аудита — да, намеренно:** при открытии страницы события вызывается `ensureCurrentParticipant` → `joinEventAsParticipant`.

- participant = доступ к приватному контексту;
- RSVP = отдельный ответ.

Для MVP это согласованная модель.

## 8. Очки за RSVP

Раньше `submitRsvpResponse` давал +1 при каждом переключении (можно было «фармить»).

**Рекомендация аудита:** убрать очки за RSVP или начислять один раз. В текущем коде переключения RSVP очки не дают.

## 9. `photoService` и обложки

`photoService` не отвечает за обложку/фон страницы события — это pipeline `eventService` + Storage для visuals.

## 10. Планы на момент аудита

**План A** — быстрый MVP без Storage: только пресеты + поля цвета/ID в `events`.

**План B** — Storage: `coverFileId`, `backgroundFileId`, upload через бакет.

## Итог аудита

Первый multi-user сценарий (profile → event → participant) работал, но визуальное состояние события было **частично** в backend.

Организатор видел больше из-за local-кэша.

---

## Обновление 2026-05-21 (после аудита)

Реализовано:

- отдельные ветки `coverFileId` и `backgroundFileId`;
- фон больше не подменяется `coverStart`, если нет `backgroundFileId`;
- `organizerName` из `participants`, не из `events`;
- после create/edit — повторное чтение события из Appwrite перед показом в UI.

Дальнейшие шаги: общий альбом, чат, достижения — см. журнал `docs/development-log.md`.
