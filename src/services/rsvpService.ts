// TODO: add Appwrite implementation when VITE_DATA_MODE=appwrite

import { eventService } from './eventService'
import type { EventRsvpEntry, EventRsvpStatus } from '../types/rsvp'
import { normalizeRsvpEntry } from '../types/rsvp'

const RSVP_STORAGE_KEY = 'event-gallery:rsvps'

function canUseLocalStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function createId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
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

function migrateEventRsvpsIfNeeded(eventId: string) {
  const stored = readStoredRsvps()
  const existing = stored.filter((entry) => entry.eventId === eventId)
  if (existing.length > 0) {
    return existing
  }

  const event = eventService.getHomeEvents().find((item) => item.id === eventId)
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

export const rsvpService = {
  async getEventRsvps(eventId: string): Promise<EventRsvpEntry[]> {
    const stored = readStoredRsvps().filter((entry) => entry.eventId === eventId)
    if (stored.length > 0) {
      return stored
    }

    return migrateEventRsvpsIfNeeded(eventId)
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
    const entries = readStoredRsvps()
    const existing = entries.find(
      (entry) => entry.eventId === input.eventId && entry.participantId === input.participantId,
    )

    const nextEntry = normalizeRsvpEntry({
      id: existing?.id ?? createId('rsvp'),
      eventId: input.eventId,
      userId: input.userId,
      participantId: input.participantId,
      displayName: input.displayName,
      avatarUrl: input.avatarUrl,
      status: input.status,
      message: input.message ?? '',
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      userName: input.displayName,
      userInitials: existing?.userInitials,
    })

    persistRsvps(
      existing
        ? entries.map((entry) => (entry.id === existing.id ? nextEntry : entry))
        : [...entries, nextEntry],
    )

    return nextEntry
  },

  async updateRsvpMessage(rsvpId: string, message: string): Promise<EventRsvpEntry> {
    return updateStoredRsvp(rsvpId, (entry) => ({
      ...entry,
      message,
      updatedAt: new Date().toISOString(),
    }))
  },

  async deleteRsvp(rsvpId: string): Promise<void> {
    persistRsvps(readStoredRsvps().filter((entry) => entry.id !== rsvpId))
  },
}
