## Data Modes

- `VITE_DATA_MODE=local` - current development mode with mock data and localStorage.
- `VITE_DATA_MODE=appwrite` - future backend mode for gradual Appwrite integration.

## Backend / Appwrite Plan

- Appwrite runtime config + client are prepared, but services still run in localStorage mode.
- The planned Appwrite Database/Storage schema is documented here: `docs/appwrite-schema.md`.
- The migration plan is to switch services to Appwrite one by one, while keeping `local` mode as a safe fallback for demos/defense.
