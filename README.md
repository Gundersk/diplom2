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
- If an Appwrite session already exists, `authService` reuses it instead of creating a new guest session.
- If a session exists but the `profiles` document is missing, `authService` restores that profile for the same `userId`.
- `profiles` is strongly recommended as the next collection for storing displayName, avatarUrl, and mode. If it is missing, auth still works and falls back to lightweight local cache for profile extras.
- `photoService`, `savedPhotoService`, `photoCommentService`, `achievementService`, `rsvpService`, and `chatService` still use localStorage for now.

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
- The script also creates/checks the `event_gallery_photos` bucket for shared event cover/background uploads.
- The current frontend still uses Appwrite only for `authService`, `eventService`, and `participantService` in `VITE_DATA_MODE=appwrite`.
- `node-appwrite` is kept on the current `1.9.x`-compatible line. The SDK can still warn when its generated patch target (for example `1.9.5`) is newer than the local server patch (for example `1.9.0`). Per Appwrite's release policy and the Node SDK README, `1.9.x` remains backward compatible within the major line; upgrading the local Appwrite server to a newer `1.9.x` patch is still recommended when convenient.

## Shared Event Visuals

- In `VITE_DATA_MODE=appwrite`, custom event cover/background uploads now go through Appwrite Storage.
- The minimal MVP flow only covers event visuals:
  - `coverFileId`
  - `backgroundFileId`
  - `backgroundMode`
  - `backgroundColor`
  - `accent`
  - `titleStyle`
  - `rsvpStyle`
- This step does **not** migrate the photo album, saved photos, comments, or avatars to Storage yet.
- Old `coverUrl` / `themeColor` fallbacks are preserved for older documents and partial migration states.

## Multi-user Test

1. Set `VITE_DATA_MODE=appwrite`.
2. Start the app and create an event in the first browser window.
3. Open the event page and copy the invite link.
4. Open the link in a second browser or an incognito window.
5. Sign in as a guest.
6. Check the `participants` collection in Appwrite Console: a second participant should appear with a different `userId`.

## Participant vs RSVP Model

- `participant` means the user has entered the private event context and has access to that event.
- `RSVP` is a separate response layer: `going`, `maybe`, or `not-going`.
- Choosing `not-going` does **not** remove the participant record.
- In appwrite mode, **My events** should show only events linked to the current user:
  - events they organize;
  - events where they are already a participant.
- RSVP changes do not grant repeatable points in the current MVP flow. Photo upload points are still preserved as the main lightweight gamification action.
