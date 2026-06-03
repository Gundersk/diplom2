import type { Models } from 'appwrite'
import { Permission, Role } from 'appwrite'
import { APPWRITE_COLLECTIONS, APPWRITE_DATABASE_ID } from '../config/appwriteSchema'
import { hasAppwriteRuntimeConfig } from '../config/runtime'
import { appwriteDatabases, appwriteId, appwriteQuery } from '../lib/appwrite'
import type { EventRsvpEntry, EventRsvpStatus } from '../types/rsvp'
import { normalizeRsvpEntry } from '../types/rsvp'
import { dedupeRsvpEntries } from '../utils/dedupeRsvp'
import { canSetGoingRsvp, EVENT_CAPACITY_FULL_MESSAGE } from '../utils/eventCapacity'
import { resolveAvatarViewUrl } from '../utils/avatarUrl'
import { readMergedGuestUserIds } from '../utils/mergedGuestIds'
import { sanitizePersistableUrl } from '../utils/persistableUrl'
import { authService } from './authService'
import { isAppwriteMode } from './adapters/dataMode'
import { eventService } from './eventService'

const RSVP_STORAGE_KEY = 'event-gallery:rsvps'

type RsvpDocument = Models.Document & {
  eventId: string
  userId: string
  participantId: string
  displayName: string
  avatarUrl?: string
  status: EventRsvpStatus
  message?: string
  createdAt: string
  updatedAt?: string
}

function canUseLocalStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function createId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

function buildRsvpInitials(displayName: string) {
  const parts = displayName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'Г'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase()
}

function assertAppwriteReady(methodName: string) {
  if (!hasAppwriteRuntimeConfig() || !APPWRITE_DATABASE_ID) {
    const message =
      `[rsvpService] ${methodName} requires Appwrite runtime config and an existing rsvps collection.`
    console.error(message)
    throw new Error('Appwrite mode is enabled, but the RSVP adapter is not configured yet.')
  }
}

function readStoredRsvps(): EventRsvpEntry[] {
  if (!canUseLocalStorage()) return []

  const raw = window.localStorage.getItem(RSVP_STORAGE_KEY)
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      throw new Error('Stored rsvps payload is not an array.')
    }

    return parsed.map((entry) => normalizeRsvpEntry(entry as EventRsvpEntry))
  } catch {
    window.localStorage.removeItem(RSVP_STORAGE_KEY)
    return []
  }
}

function persistRsvps(entries: EventRsvpEntry[]) {
  if (!canUseLocalStorage()) return
  window.localStorage.setItem(
    RSVP_STORAGE_KEY,
    JSON.stringify(entries.map((entry) => normalizeRsvpEntry(entry))),
  )
}

function normalizeRsvpDocument(document: RsvpDocument): EventRsvpEntry {
  const displayName = document.displayName?.trim() || 'Гость'
  return normalizeRsvpEntry({
    id: document.$id,
    eventId: document.eventId,
    userId: document.userId,
    participantId: document.participantId,
    displayName,
    avatarUrl: document.avatarUrl,
    status: document.status,
    message: document.message ?? '',
    createdAt: document.createdAt ?? document.$createdAt,
    updatedAt: document.updatedAt ?? document.$updatedAt ?? document.$createdAt,
    userName: displayName,
    userInitials: buildRsvpInitials(displayName),
  })
}

async function migrateEventRsvpsIfNeeded(eventId: string) {
  const stored = readStoredRsvps()
  const existing = stored.filter((entry) => entry.eventId === eventId)
  if (existing.length > 0) {
    return existing
  }

  const events = await eventService.getHomeEvents()
  const event = events.find((item) => item.id === eventId)
  if (!event || event.guestRsvps.length === 0) {
    return []
  }

  const migrated = event.guestRsvps.map((entry) =>
    normalizeRsvpEntry({
      ...entry,
      eventId,
      displayName: entry.displayName ?? entry.userName ?? 'Гость',
      createdAt: entry.createdAt ?? event.startsAt,
    }),
  )

  persistRsvps([...stored, ...migrated])
  return migrated
}

function updateStoredRsvp(rsvpId: string, updater: (entry: EventRsvpEntry) => EventRsvpEntry) {
  const entries = readStoredRsvps()
  const index = entries.findIndex((entry) => entry.id === rsvpId)
  if (index === -1) {
    throw new Error('RSVP не найден.')
  }

  const nextEntry = normalizeRsvpEntry(updater(entries[index]))
  entries[index] = nextEntry
  persistRsvps(entries)
  return nextEntry
}

async function findRsvpDocument(eventId: string, participantId: string) {
  const response = await appwriteDatabases.listDocuments<RsvpDocument>(
    APPWRITE_DATABASE_ID,
    APPWRITE_COLLECTIONS.rsvps,
    [
      appwriteQuery.equal('eventId', eventId),
      appwriteQuery.equal('participantId', participantId),
      appwriteQuery.limit(1),
    ],
  )

  return response.documents[0] ?? null
}

async function findRsvpDocumentByUser(eventId: string, userId: string) {
  const response = await appwriteDatabases.listDocuments<RsvpDocument>(
    APPWRITE_DATABASE_ID,
    APPWRITE_COLLECTIONS.rsvps,
    [
      appwriteQuery.equal('eventId', eventId),
      appwriteQuery.equal('userId', userId),
      appwriteQuery.limit(1),
    ],
  )

  return response.documents[0] ?? null
}

async function findRsvpDocumentForCurrentUser(eventId: string, userId: string) {
  const directMatch = await findRsvpDocumentByUser(eventId, userId)
  if (directMatch) {
    return directMatch
  }

  for (const guestUserId of readMergedGuestUserIds()) {
    if (guestUserId === userId) continue
    const guestMatch = await findRsvpDocumentByUser(eventId, guestUserId)
    if (guestMatch) {
      return guestMatch
    }
  }

  return null
}

function buildLocalRsvpEntry(input: {
  eventId: string
  userId: string
  participantId: string
  displayName: string
  avatarUrl?: string
  status: EventRsvpStatus
  message?: string
  existing?: EventRsvpEntry | null
}): EventRsvpEntry {
  const displayName = input.displayName.trim() || 'Гость'
  return normalizeRsvpEntry({
    id: input.existing?.id ?? createId('rsvp'),
    eventId: input.eventId,
    userId: input.userId,
    participantId: input.participantId,
    displayName,
    avatarUrl: isAppwriteMode() ? sanitizePersistableUrl(input.avatarUrl) : input.avatarUrl,
    status: input.status,
    message: input.message ?? '',
    createdAt: input.existing?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    userName: displayName,
    userInitials: input.existing?.userInitials ?? buildRsvpInitials(displayName),
  })
}

export const rsvpService = {
  async getEventRsvps(eventId: string): Promise<EventRsvpEntry[]> {
    if (!isAppwriteMode()) {
      const stored = readStoredRsvps().filter((entry) => entry.eventId === eventId)
      if (stored.length > 0) {
        return stored
      }

      return await migrateEventRsvpsIfNeeded(eventId)
    }

    assertAppwriteReady('getEventRsvps')
    const response = await appwriteDatabases.listDocuments<RsvpDocument>(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTIONS.rsvps,
      [
        appwriteQuery.equal('eventId', eventId),
        appwriteQuery.limit(5000),
      ],
    )

    const entries = response.documents.map((document) => normalizeRsvpDocument(document))
    const currentUser = await authService.getCurrentUser()
    if (!currentUser?.id) {
      return entries
    }

    return dedupeRsvpEntries(entries, currentUser.id)
  },

  async getParticipantRsvp(eventId: string, participantId: string): Promise<EventRsvpEntry | null> {
    const entries = await this.getEventRsvps(eventId)
    return entries.find((entry) => entry.participantId === participantId) ?? null
  },

  async setParticipantRsvp(input: {
    eventId: string
    userId: string
    participantId: string
    displayName: string
    avatarUrl?: string
    status: EventRsvpStatus
    message?: string
  }): Promise<EventRsvpEntry> {
    if (input.status === 'going') {
      const event = await eventService.getEventById(input.eventId)
      const guestRsvps = await this.getEventRsvps(input.eventId)

      if (
        event &&
        !canSetGoingRsvp(
          { participantLimit: event.participantLimit, guestRsvps },
          { userId: input.userId, participantId: input.participantId },
        )
      ) {
        throw new Error(EVENT_CAPACITY_FULL_MESSAGE)
      }
    }

    if (!isAppwriteMode()) {
      const entries = readStoredRsvps()
      const existing = entries.find(
        (entry) =>
          entry.eventId === input.eventId &&
          (entry.participantId === input.participantId || entry.userId === input.userId),
      )
      const nextEntry = buildLocalRsvpEntry({ ...input, existing })

      persistRsvps(
        existing
          ? entries.map((entry) => (entry.id === existing.id ? nextEntry : entry))
          : [...entries, nextEntry],
      )

      return nextEntry
    }

    assertAppwriteReady('setParticipantRsvp')
    const now = new Date().toISOString()
    const displayName = input.displayName.trim() || 'Гость'
    const avatarUrl = sanitizePersistableUrl(input.avatarUrl)
    const message = input.message?.trim() ?? ''
    const existing =
      (await findRsvpDocumentForCurrentUser(input.eventId, input.userId)) ??
      (await findRsvpDocument(input.eventId, input.participantId))

    if (existing) {
      const updated = await appwriteDatabases.updateDocument<RsvpDocument>(
        APPWRITE_DATABASE_ID,
        APPWRITE_COLLECTIONS.rsvps,
        existing.$id,
        {
          userId: input.userId,
          participantId: input.participantId,
          displayName,
          avatarUrl,
          status: input.status,
          message,
          updatedAt: now,
        },
      )

      return normalizeRsvpDocument(updated)
    }

    const created = await appwriteDatabases.createDocument<RsvpDocument>(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTIONS.rsvps,
      appwriteId.unique(),
      {
        eventId: input.eventId,
        userId: input.userId,
        participantId: input.participantId,
        displayName,
        avatarUrl,
        status: input.status,
        message,
        createdAt: now,
        updatedAt: now,
      },
      [
        Permission.read(Role.users()),
        Permission.update(Role.user(input.userId)),
        Permission.delete(Role.user(input.userId)),
      ],
    )

    return normalizeRsvpDocument(created)
  },

  async syncUserRsvpProfile(
    userId: string,
    profile: { displayName: string; avatarUrl?: string; avatarFileId?: string },
  ) {
    if (!isAppwriteMode()) {
      const displayName = profile.displayName.trim() || 'Гость'
      const avatarUrl = profile.avatarUrl
      const entries = readStoredRsvps().map((entry) =>
        entry.userId === userId
          ? normalizeRsvpEntry({
              ...entry,
              displayName,
              avatarUrl,
              userName: displayName,
              updatedAt: new Date().toISOString(),
            })
          : entry,
      )
      persistRsvps(entries)
      return
    }

    assertAppwriteReady('syncUserRsvpProfile')
    const avatarUrl = resolveAvatarViewUrl(profile.avatarUrl, profile.avatarFileId) ?? ''
    const displayName = profile.displayName.trim() || 'Гость'
    const response = await appwriteDatabases.listDocuments<RsvpDocument>(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTIONS.rsvps,
      [appwriteQuery.equal('userId', userId), appwriteQuery.limit(5000)],
    )

    await Promise.allSettled(
      response.documents.map((document) =>
        appwriteDatabases.updateDocument(APPWRITE_DATABASE_ID, APPWRITE_COLLECTIONS.rsvps, document.$id, {
          displayName,
          avatarUrl,
          updatedAt: new Date().toISOString(),
        }),
      ),
    )
  },

  async updateRsvpMessage(rsvpId: string, message: string): Promise<EventRsvpEntry> {
    if (!isAppwriteMode()) {
      return updateStoredRsvp(rsvpId, (entry) => ({
        ...entry,
        message,
        updatedAt: new Date().toISOString(),
      }))
    }

    assertAppwriteReady('updateRsvpMessage')
    const updated = await appwriteDatabases.updateDocument<RsvpDocument>(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTIONS.rsvps,
      rsvpId,
      {
        message,
        updatedAt: new Date().toISOString(),
      },
    )

    return normalizeRsvpDocument(updated)
  },

  async deleteRsvp(rsvpId: string): Promise<void> {
    if (!isAppwriteMode()) {
      persistRsvps(readStoredRsvps().filter((entry) => entry.id !== rsvpId))
      return
    }

    assertAppwriteReady('deleteRsvp')
    await appwriteDatabases.deleteDocument(APPWRITE_DATABASE_ID, APPWRITE_COLLECTIONS.rsvps, rsvpId)
  },
}
