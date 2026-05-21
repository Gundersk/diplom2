# Appwrite Schema Plan (Event Gallery)

Этот документ фиксирует целевую схему Appwrite Database/Storage для будущего подключения backend. Сейчас приложение работает в `VITE_DATA_MODE=local` (mock + localStorage), а Appwrite здесь описан как план.

## Auth (Appwrite Account)

Appwrite Auth хранит аккаунты пользователей. В MVP планируем:

- **guest**: anonymous session (гостевой вход).
- **profile**: email OTP (код на email).
- **local/demo**: остается как запасной режим для защиты/разработки.

Важно:

- `CurrentUser` идентифицируется по `userId` (id аккаунта Appwrite).
- `EventParticipant` хранит имя **внутри конкретного события** и может отличаться между событиями.
- upgrade guest -> profile должен сохранять тот же `userId`, чтобы не терять связи (events/photos/participants/…).

Пример:

- один `userId` в одном событии как “Юра”;
- в другом как “Yurgirus”;
- в третьем как “antLo”.

## Storage (Bucket)

Bucket:

- `event_gallery_photos` (фото-оригиналы)

Правило:

- **файл фото хранится физически один раз**;
- “сохранение в личную галерею” это только связь, без копирования файла.

## Коллекции (Database)

Ниже: назначение, поля и индексы. Имена коллекций соответствуют `src/config/appwriteSchema.ts`.

### 1) `profiles`

Назначение: дополнительные поля профиля поверх Appwrite Auth (displayName, avatar и т.п.).

Поля:

- `userId: string` (required, уникально)
- `mode: 'guest' | 'profile'` (required)
- `displayName: string` (optional)
- `avatarFileId: string` (optional, ссылка на Storage в будущем)
- `avatarUrl: string` (optional, если используем публичный URL/preview)
- `createdAt: datetime` (required)
- `updatedAt: datetime` (optional)

Индексы:

- `userId` (unique)

Доступ:

- читать/писать: только владелец `userId == $userId`.

### 2) `events`

Назначение: событие (карточка + настройки).

Поля:

- `title: string` (required)
- `description: string` (optional)
- `startsAt: datetime` (required)
- `endsAt: datetime` (optional)
- `timezone: string` (required)
- `location: string` (optional)
- `organizerId: string` (required, userId)
- `inviteCode: string` (required, уникально/квази-уникально)
- `coverFileId: string` (optional) / `coverUrl: string` (optional)
- `themeBackgroundFileId: string` (optional) / `themeBackgroundUrl: string` (optional)
- `themeColor: string` (optional, например hex)
- `guestsCanInvite: boolean` (required)
- `maxParticipants: number` (optional)
- `isPaid: boolean` (required)
- `costPerPerson: number` (optional)
- `paymentDetails: string` (optional)
- `paymentComment: string` (optional)
- `createdAt: datetime` (required)
- `updatedAt: datetime` (optional)

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

- `eventId: string` (required)
- `userId: string` (required)
- `displayName: string` (required)
- `role: 'organizer' | 'guest'` (required)
- `points: number` (required)
- `joinedAt: datetime` (required)
- `updatedAt: datetime` (optional)

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
- `imageUrl: string` (optional, может быть preview URL; в local режиме base64/mock)
- `uploadedByUserId: string` (required)
- `uploadedByParticipantId: string` (required)
- `authorName: string` (required)
- `authorAvatarUrl: string` (optional)
- `caption: string` (optional)
- `mimeType: string` (optional)
- `sizeBytes: number` (optional)
- `width: number` (optional)
- `height: number` (optional)
- `createdAt: datetime` (required)
- `updatedAt: datetime` (optional)

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

- `eventId: string` (required)
- `photoId: string` (required)
- `addedAt: datetime` (required)
- `addedByUserId: string` (optional)
- `addedByParticipantId: string` (optional)

Индексы:

- `eventId`
- `photoId`
- `eventId + photoId` (unique)

### 6) `saved_photos`

Назначение: “пользователь сохранил фото в личную галерею” (только связь, без копирования).

Поля:

- `userId: string` (required)
- `photoId: string` (required)
- `eventId: string` (required)
- `savedAt: datetime` (required)
- `participantId: string` (optional)

Индексы:

- `userId`
- `photoId`
- `userId + photoId` (unique)
- `eventId`

### 7) `photo_comments`

Назначение: комментарии к фото (вместо лайков в MVP).

Поля:

- `photoId: string` (required)
- `eventId: string` (required)
- `userId: string` (required)
- `participantId: string` (required)
- `authorName: string` (required)
- `authorAvatarUrl: string` (optional)
- `text: string` (required)
- `createdAt: datetime` (required)
- `updatedAt: datetime` (optional)

Индексы:

- `photoId`
- `eventId`
- `userId`
- `participantId`
- `createdAt`

### 8) `achievement_templates`

Назначение: библиотека шаблонов достижений (system + пользовательские).

Поля:

- `scope: 'automatic' | 'personal' | 'group'` (required)
- `title: string` (required)
- `description: string` (required)
- `icon: string` (required)
- `tone: string` (optional)
- `points: number` (optional)
- `conditionType: string` (optional, напр. `first_photo`, `most_photos`, `most_photo_comments`)
- `isCustom: boolean` (required)
- `createdBy: string` (optional, userId; null для system)
- `createdAt: datetime` (required)
- `updatedAt: datetime` (optional)

Индексы:

- `scope`
- `createdBy`

### 9) `event_achievements`

Назначение: выбранные/подключенные достижения конкретного события.

Поля:

- `eventId: string` (required)
- `templateId: string` (optional)
- `scope: 'automatic' | 'personal' | 'group'` (required)
- `title: string` (required)
- `description: string` (required)
- `icon: string` (required)
- `tone: string` (optional)
- `points: number` (optional)
- `selected: boolean` (required)
- `createdBy: string` (optional)
- `assignedToUserId: string` (optional)
- `assignedToParticipantId: string` (optional)
- `createdAt: datetime` (required)
- `updatedAt: datetime` (optional)

Индексы:

- `eventId`
- `templateId`
- `scope`
- `selected`

### 10) `rsvps`

Назначение: RSVP-ответ участника события.

Поля:

- `eventId: string` (required)
- `userId: string` (required)
- `participantId: string` (required)
- `displayName: string` (required)
- `avatarUrl: string` (optional)
- `status: 'going' | 'maybe' | 'not-going'` (required)
- `message: string` (optional)
- `createdAt: datetime` (required)
- `updatedAt: datetime` (optional)

Индексы:

- `eventId`
- `userId`
- `participantId`
- `eventId + participantId` (unique)

### 11) `chat_messages`

Назначение: чат события.

Поля:

- `eventId: string` (required)
- `userId: string` (required)
- `participantId: string` (required)
- `authorName: string` (required)
- `authorAvatarUrl: string` (optional)
- `authorInitials: string` (optional)
- `text: string` (required)
- `photoId: string` (optional)
- `createdAt: datetime` (required)
- `updatedAt: datetime` (optional)

Индексы:

- `eventId`
- `userId`
- `participantId`
- `createdAt`

## Экономная модель фото (обязательно)

1. Фото-файл хранится один раз в Storage, `photos.storageFileId` указывает на него.
2. Альбом события хранит **связи** в `event_photos` (`eventId + photoId`).
3. Личная галерея хранит **связи** в `saved_photos` (`userId + photoId + eventId`).
4. Комментарии живут в `photo_comments` и привязаны к `photoId + eventId`.

Удаление:

- удалить из альбома события: удалить `event_photos` link
- удалить из личной галереи: удалить `saved_photos` link
- физически удалить файл и `photos` metadata только если:
  - нет ссылок в `event_photos` для `photoId`
  - нет ссылок в `saved_photos` для `photoId`

