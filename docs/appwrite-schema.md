# Схема Appwrite (Event Gallery)

Целевая схема Database/Storage для backend. При `VITE_DATA_MODE=local` приложение работает на mock + localStorage; ниже — план и фактическая схема для Appwrite.

## Auth (аккаунты Appwrite)

Appwrite Auth хранит аккаунты пользователей. В MVP планируем:

- **guest** — anonymous session (гостевой вход).
- **profile** — OTP на email.
- **local/demo** — запасной режим для защиты без Appwrite.

Важно:

- `CurrentUser` идентифицируется по `userId` (id аккаунта Appwrite).
- `EventParticipant` хранит имя **внутри конкретного события** и может отличаться между событиями.
- При апгрейде guest → profile сохраняется тот же `userId`, чтобы не терять связи (events, photos, participants…).

Пример:

- один `userId` в одном событии как “Юра”;
- в другом как “Yurgirus”;
- в третьем как “antLo”.

## Storage (бакет)

Бакет `event_gallery_photos` — оригиналы файлов (обложки, фоны, альбом, аватары).

Уже используется в appwrite mode:

- обложка и фон события;
- фото альбома и аватары.

Отдельными шагами: `saved_photos` (личная галерея). Комментарии к фото в UI сняты.

Правило:

- **файл фото хранится физически один раз**;
- “сохранение в личную галерею” это только связь, без копирования файла.

## Коллекции (Database)

Ниже: назначение, поля и индексы. Имена коллекций соответствуют `src/config/appwriteSchema.ts`.

### 1) `profiles`

Назначение: дополнительные поля профиля поверх Appwrite Auth (displayName, avatar и т.п.).

Поля:

- `userId: string` (required, уникально)
- `mode: 'guest' | 'profile'` (обяз.)
- `displayName: string` (опц.)
- `avatarFileId: string` (опц., Appwrite Storage file id in `event_gallery_photos`)
- `avatarUrl: string` (опц., short Appwrite Storage view URL — not base64)
- `createdAt: datetime` (обяз.)
- `updatedAt: datetime` (опц.)

Индексы:

- `userId` (unique)

Доступ:

- читать/писать: только владелец `userId == $userId`.

### 2) `events`

Назначение: событие (карточка + настройки).

Поля:

- `title: string` (обяз.)
- `description: string` (опц.)
- `startsAt: datetime` (обяз.)
- `endsAt: datetime` (опц.)
- `createdAt: datetime` (обяз.)
- `updatedAt: datetime` (опц.)
- `location: string` (опц.)
- `organizerId: string` (required, userId)
- `inviteCode: string` (required, уникально/квази-уникально)
- `coverUrl: string` (опц., legacy/fallback для пресетных обложек)
- `coverFileId: string` (опц., Appwrite Storage file id for custom cover)
- `backgroundFileId: string` (опц., Appwrite Storage file id for custom background)
- `backgroundUrl: string` (опц., URL пресетного фона для шаринга)
- `backgroundMode: string` (опц., `asset` | `color`)
- `backgroundMediaType: string` (опц., `image` | `gif` | `video`)
- `backgroundColor: string` (опц.)
- `themeColor: string` (опц., запасной цвет акцента/фона)
- `accent: string` (опц.)
- `allowGuestInvites: boolean` (обяз.)
- `participantLimit: number` (опц.)
- `paymentDetails: string` (опц.)
- `paymentComment: string` (опц.)
- `costPerPerson: string` (опц.)
- `timezone: string` (опц.)
- `titleStyle: string` (опц.)
- `rsvpStyle: string` (опц.)
- `textTheme: string` (опц., `auto` | `light` | `dark`)

Важно:

- `organizerName` не хранится в `events`;
- имя организатора должно приходить из `profiles` / `participants`;
- custom cover/background file живут в Storage, а в `events` хранится только fileId и нужные визуальные настройки.

Индексы:

- `organizerId`
- `inviteCode` (unique или tight)
- `startsAt`

Доступ:

- читать: участники события (`participants.eventId == events.$id`).
- создавать: любой авторизованный пользователь (guest/profile).
- редактировать/удалять: organizer (`organizerId == $userId`).

### 3) `participants`

Назначение: участие пользователя в конкретном событии (имя/роль/очки).

Поля:

- `eventId: string` (обяз.)
- `userId: string` (обяз.)
- `displayName: string` (обяз.)
- `role: 'organizer' | 'guest'` (обяз.)
- `points: number` (обяз.)
- `joinedAt: datetime` (обяз.)
- `updatedAt: datetime` (опц.)
- `avatarUrl: string` (опц., short Storage view URL)
- `avatarFileId: string` (опц., Storage file id)

Индексы:

- `eventId`
- `userId`
- `eventId + userId` (unique)

Доступ:

- читать: участники события
- создавать: текущий `userId` (join) или organizer (invite/management)
- редактировать: organizer или сам участник (ограниченно: displayName)

### 4) `photos`

Назначение: metadata фото + ссылка на Storage (один физический файл).

Поля:

- `storageFileId: string` (required в appwrite-режиме; optional в local режиме)
- `imageUrl: string` (опц., может быть preview URL; в local режиме base64/mock)
- `uploadedByUserId: string` (обяз.)
- `uploadedByParticipantId: string` (обяз.)
- `authorName: string` (обяз.)
- `authorAvatarUrl: string` (опц.)
- `caption: string` (опц.)
- `mimeType: string` (опц.)
- `sizeBytes: number` (опц.)
- `width: number` (опц.)
- `height: number` (опц.)
- `createdAt: datetime` (обяз.)
- `updatedAt: datetime` (опц.)

Индексы:

- `uploadedByUserId`
- `uploadedByParticipantId`
- `createdAt`

Доступ:

- читать: участники события, где фото связано через `event_photos` (см. ниже)
- создавать: участник события
- удалять: organizer или автор (по политике проекта)

### 5) `event_photos`

Назначение: связь “фото находится в альбоме события”.

Поля:

- `eventId: string` (обяз.)
- `photoId: string` (обяз.)
- `addedAt: datetime` (обяз.)
- `addedByUserId: string` (опц.)
- `addedByParticipantId: string` (опц.)

Индексы:

- `eventId`
- `photoId`
- `eventId + photoId` (unique)

### 6) `saved_photos`

Назначение: “пользователь сохранил фото в личную галерею” (только связь, без копирования).

Поля:

- `userId: string` (обяз.)
- `photoId: string` (обяз.)
- `eventId: string` (обяз.)
- `savedAt: datetime` (обяз.)
- `participantId: string` (опц.)

Индексы:

- `userId`
- `photoId`
- `userId + photoId` (unique)
- `eventId`

### 7) `photo_comments` (не в текущем MVP)

Ранний план: комментарии к фото. В текущей реализации UI комментариев нет, коллекция в `appwriteSchema.ts` не подключена. При необходимости — отдельный этап.

### 8) `achievement_templates`

Назначение: библиотека шаблонов достижений (system + пользовательские).

Поля:

- `scope: 'automatic' | 'personal' | 'group'` (обяз.)
- `title: string` (обяз.)
- `description: string` (обяз.)
- `icon: string` (обяз.)
- `tone: string` (опц.)
- `points: number` (опц.)
- `conditionType: string` (опц., напр. `first_photo`, `most_photos`, `most_likes`)
- `isCustom: boolean` (обяз.)
- `createdBy: string` (опц., userId; null для system)
- `createdAt: datetime` (обяз.)
- `updatedAt: datetime` (опц.)

Индексы:

- `scope`
- `createdBy`

### 9) `event_achievements`

Назначение: выбранные/подключенные достижения конкретного события.

Поля:

- `eventId: string` (обяз.)
- `templateId: string` (опц.)
- `scope: 'automatic' | 'personal' | 'group'` (обяз.)
- `title: string` (обяз.)
- `description: string` (обяз.)
- `icon: string` (обяз.)
- `tone: string` (опц.)
- `points: number` (опц.)
- `selected: boolean` (обяз.)
- `createdBy: string` (опц.)
- `assignedToUserId: string` (опц.)
- `assignedToParticipantId: string` (опц.)
- `createdAt: datetime` (обяз.)
- `updatedAt: datetime` (опц.)

Индексы:

- `eventId`
- `templateId`
- `scope`
- `selected`

### 10) `rsvps`

Назначение: RSVP-ответ участника события.

Поля:

- `eventId: string` (обяз.)
- `userId: string` (обяз.)
- `participantId: string` (обяз.)
- `displayName: string` (обяз.)
- `avatarUrl: string` (опц.)
- `status: 'going' | 'maybe' | 'not-going'` (обяз.)
- `message: string` (опц.)
- `createdAt: datetime` (обяз.)
- `updatedAt: datetime` (опц.)

Индексы:

- `eventId`
- `userId`
- `participantId`
- `eventId + participantId` (unique)

### 11) `chat_messages`

Назначение: чат события.

Поля:

- `eventId: string` (обяз.)
- `userId: string` (обяз.)
- `participantId: string` (обяз.)
- `authorName: string` (обяз.)
- `authorAvatarUrl: string` (опц.)
- `authorInitials: string` (опц.)
- `text: string` (обяз.)
- `photoId: string` (опц.)
- `createdAt: datetime` (обяз.)
- `updatedAt: datetime` (опц.)

Индексы:

- `eventId`
- `userId`
- `participantId`
- `createdAt`

## Экономная модель фото (обязательно)

1. Фото-файл хранится один раз в Storage, `photos.storageFileId` указывает на него.
2. Альбом события хранит **связи** в `event_photos` (`eventId + photoId`).
3. Личная галерея хранит **связи** в `saved_photos` (`userId + photoId + eventId`).
4. Личная галерея — только связи в `saved_photos`, без копирования файла.

Удаление:

- удалить из альбома события: удалить `event_photos` link
- удалить из личной галереи: удалить `saved_photos` link
- физически удалить файл и `photos` metadata только если:
  - нет ссылок в `event_photos` для `photoId`
  - нет ссылок в `saved_photos` для `photoId`

## Обновление 2026-05-22: общий альбом и чат

В `VITE_DATA_MODE=appwrite` альбом и чат синхронизируются между браузерами через коллекции ниже.

### `photos`

Назначение:

- метаданные фото альбома события;
- один физический файл в бакете `event_gallery_photos` (`storageFileId`).

Поля:
- `eventId: string` required
- `userId: string` required
- `participantId: string` required
- `authorName: string` required
- `authorAvatarUrl: string` optional
- `storageFileId: string` required
- `imageUrl: string` required
- `caption: string` optional
- `likesCount: integer` optional (устаревшее поле)
- `badgesJson: string` optional
- `createdAt: string` required
- `updatedAt: string` optional

Индексы:
- `eventId`
- `userId`
- `createdAt`

Права MVP:

- коллекция: create/read для `Role.users()`;
- документ при создании: read всем users, update/delete — владельцу.

### `chat_messages`

Назначение: общие сообщения чата события между браузерами/пользователями.

Поля:
- `eventId: string` required
- `userId: string` required
- `participantId: string` required
- `authorName: string` required
- `authorAvatarUrl: string` optional
- `authorInitials: string` optional
- `text: string` required
- `photoId: string` optional
- `createdAt: string` required
- `updatedAt: string` optional

Индексы:

- `eventId`
- `createdAt`
- `photoId`

Права — как у `photos` (см. выше).

### Заметки

- На этом шаге **не** переносились: saved photos, achievements, RSVP (частично остаются в local-кэше).
- Чат и альбом в appwrite mode идут только через Appwrite.

## Обновление MVP достижений

Для MVP-достижений модель теперь разделена на две независимые сущности:

- `event_achievements` — список достижений, доступных внутри конкретного события.
- `participant_achievements` — факт выдачи достижения конкретному участнику.

Это важно, потому что выбранное достижение события не означает автоматическое получение.

### `event_achievements`

Назначение:
достижения, которые организатор подключил к событию и которые видны на странице события.

Основные поля:

- `eventId: string`
- `templateId: string | null`
- `scope: 'automatic' | 'personal' | 'group'`
- `title: string`
- `description: string`
- `icon: string`
- `tone: string`
- `visibility: 'visible' | 'hint' | 'hidden'`
- `points: number | null`
- `createdBy: string | null`
- `createdAt: string`
- `updatedAt: string | null`
- `selected: boolean`

Индексы MVP:

- `eventId`
- `visibility`

### `participant_achievements`

Назначение:
связь между участником события и достижением, которое ему реально выдали.

Основные поля:

- `eventId: string`
- `achievementId: string`
- `participantId: string`
- `userId: string`
- `awardedByUserId: string`
- `awardedAt: string`

Индексы MVP:

- `eventId`
- `achievementId`
- `participantId`
- `userId`
- `achievementId + participantId` (уникально, где поддерживает индекс)

### UI-модель

- Участник видит общий список достижений события и свой прогресс по ним.
- `visible`: до получения участник видит icon, title и description.
- `hint`: до получения участник видит icon и title, но вместо description получает `Условие скрыто`.
- `hidden`: до получения участник не видит отдельную карточку, только общий счетчик скрытых достижений.
- После выдачи любое достижение раскрывается полностью.
- Организатор вручную выдает достижения выбранным участникам.
- Appwrite realtime для достижений пока не используется: после действия экран просто перечитывает awards из сервиса.
- `local` mode remains the fallback for demos and offline/backend-free development.
