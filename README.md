## Data Modes

- `VITE_DATA_MODE=local` - current development mode with mock data and localStorage.
- `VITE_DATA_MODE=appwrite` - future backend mode for gradual Appwrite integration.

## Backend / Appwrite Plan

- Appwrite runtime config + client are prepared, but services still run in localStorage mode.
- The planned Appwrite Database/Storage schema is documented here: `docs/appwrite-schema.md`.
- The migration plan is to switch services to Appwrite one by one, while keeping `local` mode as a safe fallback for demos/defense.

## Appwrite Mode

- Enable backend mode with `VITE_DATA_MODE=appwrite`.
- The first required Appwrite collections are `events` and `participants`.
- The first shared Storage flow is now prepared for event cover/background visuals.
- `authService` now uses Appwrite Auth anonymous sessions for guest login in appwrite mode.
- The first real Appwrite adapters already exist for `authService`, `eventService`, and `participantService`.
- `photoService` and `chatService` now also use Appwrite in `VITE_DATA_MODE=appwrite` for shared event photos and shared event chat.
- If an Appwrite session already exists, `authService` reuses it instead of creating a new guest session.
- If a session exists but the `profiles` document is missing, `authService` restores that profile for the same `userId`.
- `profiles` is strongly recommended as the next collection for storing displayName, avatarUrl, and mode. If it is missing, auth still works and falls back to lightweight local cache for profile extras.
- `savedPhotoService`, `photoCommentService`, `achievementService`, and `rsvpService` still use localStorage for now.

## Appwrite Schema Setup

1. Copy `.env.setup.example` to `.env.setup`.
2. Fill in:
   - `APPWRITE_ENDPOINT`
   - `APPWRITE_PROJECT_ID`
   - `APPWRITE_DATABASE_ID`
   - `APPWRITE_BUCKET_ID`
   - `APPWRITE_API_KEY`
3. Run:

```bash
npm run setup:appwrite
```

Notes:

- `.env.setup` is local-only and ignored by git.
- The setup script is idempotent: existing collections, attributes, and indexes are skipped.
- If an index already exists in `failed` status, the setup script removes that failed index and recreates it.
- The script currently creates the first backend collections used by the app:
  - `profiles`
  - `events`
  - `participants`
- After the shared chat/photo step, it should also create:
  - `photos`
  - `chat_messages`
- The script also creates/checks the `event_gallery_photos` bucket for shared event cover/background uploads.
- The current frontend uses Appwrite for:
  - `authService`
  - `eventService`
  - `participantService`
  - `photoService`
  - `chatService`

## Shared Event Chat And Photos

- In `VITE_DATA_MODE=appwrite`, event chat messages and album photos are now shared between browsers/users through Appwrite.
- Event photo uploads use the existing `event_gallery_photos` bucket.
- The `photos` collection stores metadata plus `storageFileId` and `imageUrl`.
- The `chat_messages` collection stores shared event chat messages and optional `photoId`.
- `local` mode is still preserved as the demo/localStorage fallback.

Important after pull:

- Run `npm run setup:appwrite` manually before testing shared photos/chat, otherwise the new `photos` and `chat_messages` collections will not exist yet.
- `node-appwrite` is kept on the current `1.9.x`-compatible line. The SDK can still warn when its generated patch target (for example `1.9.5`) is newer than the local server patch (for example `1.9.0`). Per Appwrite's release policy and the Node SDK README, `1.9.x` remains backward compatible within the major line; upgrading the local Appwrite server to a newer `1.9.x` patch is still recommended when convenient.

## Shared Event Visuals

- In `VITE_DATA_MODE=appwrite`, custom event cover/background uploads now go through Appwrite Storage.
- The minimal MVP flow only covers event visuals:
  - `coverFileId`
  - `backgroundFileId`
  - `backgroundUrl`
  - `backgroundMode`
  - `backgroundMediaType`
  - `backgroundColor`
  - `accent`
  - `titleStyle`
  - `rsvpStyle`
- User avatars in appwrite mode are uploaded to the `event_gallery_photos` bucket via `storageService.uploadUserAvatar()`. `profiles.avatarUrl` stores the short Appwrite view URL; `profiles.avatarFileId` stores the file id. Base64 data URLs are not persisted.
- This step does **not** migrate saved photos or comments to Storage yet.
- Old `coverUrl` / `themeColor` fallbacks are preserved for older documents and partial migration states.

## Multi-user Test

1. Set `VITE_DATA_MODE=appwrite`.
2. Start the app and create an event in the first browser window.
3. Open the event page and copy the invite link.
4. Open the link in a second browser or an incognito window.
5. Sign in as a guest.
6. Check the `participants` collection in Appwrite Console: a second participant should appear with a different `userId`.

## Shared Chat / Photo Test

1. Run `npm run setup:appwrite`.
2. Start the app with `VITE_DATA_MODE=appwrite`.
3. Create an event in the first browser window.
4. Open the invite link in a second browser or incognito window.
5. Sign in as a guest.
6. Send a chat message from the guest.
7. Upload a photo into the album from the guest.
8. Upload a photo through the chat input from the guest.
9. Refresh or reopen the same event as the organizer and verify:
   - the guest message is visible;
   - the uploaded album photo is visible;
   - the chat photo message is visible and linked via `photoId`.

## Participant vs RSVP Model

- `participant` means the user has entered the private event context and has access to that event.
- `RSVP` is a separate response layer: `going`, `maybe`, or `not-going`.
- Choosing `not-going` does **not** remove the participant record.
- In appwrite mode, **My events** should show only events linked to the current user:
  - events they organize;
  - events where they are already a participant.
- RSVP changes do not grant repeatable points in the current MVP flow. Photo upload points are still preserved as the main lightweight gamification action.

## Event Achievements MVP

- Event achievements are now split into two layers:
  - `event_achievements` = achievements configured for a specific event;
  - `participant_achievements` = actual awards received by concrete participants.
- Organizers manually award achievements from the event page.
- Participants see a progress panel with:
  - unlocked achievements highlighted;
  - `visible` achievements shown openly before receiving;
  - `hint` achievements shown with icon/title, but with hidden condition text;
  - `hidden` achievements omitted from the list until receiving, with only a `Скрытых: X` summary.
- Selected event achievements are **not** automatically granted anymore just because they were added to the event.
- After pulling this step, run `npm run setup:appwrite` manually so Appwrite creates:
  - `event_achievements`
  - `participant_achievements`
