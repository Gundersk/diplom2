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
- `authService` now uses Appwrite Auth anonymous sessions for guest login in appwrite mode.
- The first real Appwrite adapters already exist for `authService`, `eventService`, and `participantService`.
- `profiles` is strongly recommended as the next collection for storing displayName, avatarUrl, and mode. If it is missing, auth still works and falls back to lightweight local cache for profile extras.
- `photoService`, `savedPhotoService`, `photoCommentService`, `achievementService`, `rsvpService`, and `chatService` still use localStorage for now.

## Appwrite Schema Setup

1. Copy `.env.setup.example` to `.env.setup`.
2. Fill in:
   - `APPWRITE_ENDPOINT`
   - `APPWRITE_PROJECT_ID`
   - `APPWRITE_DATABASE_ID`
   - `APPWRITE_API_KEY`
3. Run:

```bash
npm run setup:appwrite
```

Notes:

- `.env.setup` is local-only and ignored by git.
- The setup script is idempotent: existing collections, attributes, and indexes are skipped.
- The script currently creates the first backend collections used by the app:
  - `profiles`
  - `events`
  - `participants`
- The current frontend still uses Appwrite only for `authService`, `eventService`, and `participantService` in `VITE_DATA_MODE=appwrite`.

## Multi-user Test

1. Set `VITE_DATA_MODE=appwrite`.
2. Start the app and create an event in the first browser window.
3. Open the event page and copy the invite link.
4. Open the link in a second browser or an incognito window.
5. Sign in as a guest.
6. Check the `participants` collection in Appwrite Console: a second participant should appear with a different `userId`.
