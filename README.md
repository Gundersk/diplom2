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
- The first real Appwrite adapters already exist for `eventService` and `participantService`.
- `photoService`, `savedPhotoService`, `photoCommentService`, `achievementService`, `rsvpService`, and `chatService` still use localStorage for now.
