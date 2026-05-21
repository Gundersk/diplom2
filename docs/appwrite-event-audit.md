# Appwrite Event Persistence Audit

Date: 2026-05-21

Scope:
- `C:/Users/Yurgirus/Desktop/diplom2/src/services/eventService.ts`
- `C:/Users/Yurgirus/Desktop/diplom2/src/services/photoService.ts`
- `C:/Users/Yurgirus/Desktop/diplom2/src/services/participantService.ts`
- `C:/Users/Yurgirus/Desktop/diplom2/src/services/rsvpService.ts`
- `C:/Users/Yurgirus/Desktop/diplom2/src/App.vue`
- `C:/Users/Yurgirus/Desktop/diplom2/src/types/event.ts`

Goal:
Understand what the first Appwrite-backed event flow actually persists, what still lives only in browser-local state, and why event visuals diverge between the organizer and another invited guest.

## 1. What event form fields are actually persisted to Appwrite `events`

Current Appwrite payload is built in `toAppwriteEventPayload(...)` in `src/services/eventService.ts`.

Persisted to `events`:

- `title`
- `description`
- `startsAt`
- `endsAt`
- `timezone`
- `location`
- `organizerId`
- `inviteCode`
- `coverUrl`
- `themeColor`
- `guestsCanInvite`
- `maxParticipants`
- `isPaid`
- `costPerPerson`
- `paymentDetails`
- `paymentComment`
- `createdAt`
- `updatedAt`

Notes:
- `coverUrl` is derived from `event.coverStart` only when `coverStart` is not a color.
- `themeColor` is currently used as a compressed fallback for the background/accent theme, not as a full representation of the event background state.

## 2. What event form fields are currently lost in Appwrite mode

These fields exist in the frontend event model or form, but are not persisted to Appwrite `events`:

- `organizerName`
- `organizerInitials`
- `organizerTone`
- `organizerAvatarSrc`
- `coverEnd`
- `backgroundStart`
- `backgroundEnd`
- `accent`
- `backgroundMode`
- `backgroundAssetId`
- `backgroundColor`
- `coverAssetId`
- `titleStyle`
- `rsvpStyle`
- `infoBlocks`

Also not shared through Appwrite yet:

- event achievements selected in the create/edit flow
- event photos
- event chat messages
- event RSVP list

Those areas already have separate services or local models, but they still remain browser-local for now.

## 3. What event fields are currently reconstructed from local cache or fallback

The Appwrite document is not enough to rebuild the full UI event state. The code currently compensates by mixing the Appwrite document with browser-local cached event state.

### In `src/services/eventService.ts`

`fromAppwriteEventDocument(...)` restores or guesses these fields through cached state or fallback values:

- `organizerName`
- `organizerInitials`
- `organizerTone`
- `organizerAvatarSrc`
- `coverStart`
- `coverEnd`
- `backgroundStart`
- `backgroundEnd`
- `accent`
- `infoBlocks`
- `payment` fallback
- `timezoneLabel`
- `titleStyle`
- `rsvpStyle`

`mergeEventWithCachedUiState(...)` additionally overlays:

- `achievements`
- `photos`
- `chatMessages`
- `guestRsvps`
- `savedCount`
- `totalCount`

This means the organizer can often still see a "complete" event immediately after creation because their browser keeps a richer local version in `event-gallery.home-events`, but another browser only sees what can be reconstructed from the Appwrite document plus its own local fallbacks.

## 4. Why custom cover/background is not visible for another user

There are two different issues here.

### 4.1 Uploaded cover/background files are currently stored as `blob:` URLs in the browser

In `src/App.vue`:

- `handleCoverUpload(...)` uses `window.URL.createObjectURL(file)`
- `handleBackgroundUpload(...)` uses `window.URL.createObjectURL(file)`

That value is written into:

- `createEventForm.uploadedCoverUrl`
- `createEventForm.uploadedBackgroundUrl`

Then `createEventFromForm()` copies those values into:

- `coverStart`
- `backgroundStart`

Problem:

`blob:` / object URLs are local to the current browser session. Another browser, another device, or even a reloaded session cannot reliably use that URL.

So even when the organizer sees the image locally, it is not a portable shared asset.

### 4.2 The background asset is not fully persisted to Appwrite at all

`toAppwriteEventPayload(...)` currently sends:

- `coverUrl`
- `themeColor`

But it does **not** send:

- `backgroundStart` as a URL
- `backgroundEnd`
- `backgroundMode`

So for background visuals:

- a chosen background image is dropped from the Appwrite payload
- another user reconstructs the event page from `themeColor` plus hardcoded fallbacks
- result: they see a flat/fallback background instead of the chosen background asset

### 4.3 Why the organizer may still see "the correct" event after save

Because the organizer still has browser-local cached event state:

- `eventService.createEvent(...)` and `eventService.updateEvent(...)` persist the full normalized event into local cache
- `fromAppwriteEventDocument(...)` later overlays cached event UI state

So the current browser can mask missing backend persistence.

## 5. What needs to be added to Appwrite schema minimally to preserve visual event state without Storage

If the goal is a quick backend MVP **without Appwrite Storage**, the safest path is:

- support only predefined bundled assets and color themes
- persist asset identifiers or explicit background fields
- do not treat browser-uploaded files as shared assets yet

Minimal schema additions recommended for correct shared visuals:

- `backgroundMode` (`asset` | `color`)
- `backgroundAssetId` or `backgroundUrl`
- `backgroundColor`
- `accent`
- `titleStyle`
- `rsvpStyle`
- `infoBlocksJson` or a separate future collection

Optional but useful:

- `coverAssetId` instead of relying only on `coverUrl`

Why this is enough for a no-Storage MVP:

- bundled poster/background assets can be re-resolved by ID on every client
- solid color themes can be recreated from stored color values
- preview and event page become deterministic across browsers

## 6. What cannot be done correctly without Appwrite Storage

These cases are not robust without Storage:

- user-uploaded custom cover images
- user-uploaded custom background images
- uploaded GIF/video cover/background assets shared between browsers
- durable cross-device file URLs
- safe file lifecycle for replacing/deleting uploaded event visuals

Technically it is possible to store base64 inside database string fields, but for this project it would be a weak solution:

- large payloads
- poor performance
- bad maintainability
- awkward limits for images/GIF/video

Recommendation:
Do not use database string fields as a fake file storage layer for event visuals.

## 7. Should participant be created immediately on invite-link entry

Current behavior is intentional in code.

### Current flow

When an authenticated user opens an event page:

- `watch([activeEvent, currentUser.id, currentUser.displayName, currentView], ...)`
- calls `ensureCurrentParticipant(event)`
- which calls `participantService.joinEventAsParticipant(...)`

So `participant` is created/upserted as soon as the user enters the event page.

### Meaning of the current model

Right now the model is:

- `participant` = user who has entered / joined the private event context
- `RSVP` = separate response inside that event

This is a coherent model for invite-only events.

### Recommendation

For MVP, keep this behavior.

Reason:

- it matches the current private invite flow
- it keeps access semantics simple
- it separates "has access to event" from "answered RSVP"

Change it only if you want a stricter future model like:

- invited viewer
- participant
- RSVP responder

That would require an extra entity or a more explicit invitation state.

## 8. Where RSVP points are awarded and whether to keep it

Current points gain for RSVP happens in `src/App.vue`.

Flow:

- `submitRsvpResponse()` calls `rsvpService.setParticipantRsvp(...)`
- then updates local event/chat state
- then calls `addCurrentParticipantPoints(1)`

So right now:

- every RSVP submission gives `+1`
- changing RSVP again gives another `+1`
- this can be farmed by toggling statuses

### Recommendation for MVP

Do **not** keep the current behavior as-is.

Better options:

1. Disable RSVP points entirely for MVP.
2. Or award points only on the first RSVP creation, not on every update.

Given the current lightweight gamification target, option 1 is the safest MVP choice.

## 9. Notes about `photoService`

`src/services/photoService.ts` is not involved in event cover/background persistence.

It already has TODO comments about future Appwrite Storage for event album photos, but that is a different asset pipeline from:

- event cover
- event page background

So the current cover/background sharing issue is not caused by `photoService`; it is caused by the create-event flow and the limited Appwrite `events` payload.

## 10. Recommended next plans

### Plan A: Quick MVP without Storage

Goal:
Make event visuals consistent across browsers fast, without introducing Appwrite Storage yet.

Approach:

- allow only predefined bundled cover/background assets for shared event visuals
- keep custom upload UI disabled or explicitly local-only for now
- persist:
  - `coverAssetId`
  - `backgroundMode`
  - `backgroundAssetId`
  - `backgroundColor`
  - `accent`
  - `titleStyle`
  - `rsvpStyle`
  - `infoBlocksJson`
- render visuals from stored IDs/colors instead of relying on cached event state

Pros:

- fast to implement
- no Storage dependency
- deterministic cross-browser event page

Cons:

- no real custom uploaded cover/background sharing
- uploaded event visuals remain unsupported as shared assets

### Plan B: Proper MVP with Appwrite Storage

Goal:
Support shared custom event cover/background files correctly.

Approach:

- upload custom cover/background files to Appwrite Storage
- store file metadata or URLs in `events`
- recommended event fields:
  - `coverFileId` or `coverUrl`
  - `backgroundFileId` or `backgroundUrl`
  - `backgroundMode`
  - `backgroundColor`
  - `accent`
  - `titleStyle`
  - `rsvpStyle`
  - `infoBlocksJson`
- keep `organizerName` outside `events`, resolved through `profiles` / `participants`

Pros:

- custom uploaded visuals work across browsers and devices
- event page state becomes portable and backend-backed
- aligns with the long-term Appwrite architecture

Cons:

- more moving parts
- requires Storage bucket policy and upload flow
- requires cleanup rules for replaced files

## Bottom line

The first Appwrite test succeeded for the core entity flow:

- profile
- event
- participant

But visual event state is currently only partially backend-backed.

Today the shared truth of an Appwrite event is:

- core metadata is real
- visual/editor state is partly local illusion

That is why the organizer can see more than the invited guest.

---

## 2026-05-21 update

The first shared-event repair pass is now implemented:

- `coverFileId` and `backgroundFileId` are restored through separate branches;
- background no longer falls back to `coverStart` when `backgroundFileId` is absent;
- organizer display name is resolved through `participants`, not stored back into `events`;
- create/edit flow now re-reads the updated event from Appwrite before reopening it in the UI.

This means:

- cover and background are no longer intentionally mixed in `fromAppwriteEventDocument(...)`;
- `organizerName` remains derived display state, not persisted event state;
- appwrite-mode editing is now closer to a real shared backend roundtrip.
