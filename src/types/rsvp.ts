/**
 * RSVP-ответы гостей: статусы, запись и нормализация устаревших значений.
 */
export type EventRsvpStatus = 'going' | 'maybe' | 'not-going'
export type LegacyRsvpStatus = EventRsvpStatus | 'cant_go'

export type EventRsvpEntry = {
  id: string
  eventId?: string
  userId?: string
  participantId?: string
  displayName?: string
  avatarUrl?: string
  status: EventRsvpStatus
  message?: string
  createdAt: string
  updatedAt?: string
  userName?: string
  userInitials?: string
}

/** Приводит cant_go к not-going для совместимости со старыми данными. */
export function normalizeRsvpStatus(status?: string): EventRsvpStatus {
  if (status === 'going' || status === 'maybe' || status === 'not-going') {
    return status
  }

  return status === 'cant_go' ? 'not-going' : 'maybe'
}

export function normalizeRsvpEntry(entry: EventRsvpEntry): EventRsvpEntry {
  return {
    ...entry,
    status: normalizeRsvpStatus(entry.status),
    displayName: entry.displayName ?? entry.userName ?? 'Гость',
    message: entry.message ?? '',
    createdAt: entry.createdAt ?? new Date().toISOString(),
  }
}
