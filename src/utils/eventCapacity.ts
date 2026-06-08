/**
 * Проверка лимита участников события по RSVP.
 * Учитываются только ответы со статусом «going».
 */
import type { GalleryEvent } from '../types/event'
import type { EventRsvpEntry } from '../types/rsvp'

export function countGoingRsvps(guestRsvps: EventRsvpEntry[]) {
  return guestRsvps.filter((entry) => entry.status === 'going').length
}

export function findUserRsvpEntry(
  guestRsvps: EventRsvpEntry[],
  userId?: string,
  participantId?: string,
) {
  if (!userId && !participantId) return null

  return (
    guestRsvps.find(
      (entry) =>
        (userId && entry.userId === userId) ||
        (participantId && entry.participantId === participantId),
    ) ?? null
  )
}

export function isEventAtCapacity(event: Pick<GalleryEvent, 'participantLimit' | 'guestRsvps'>) {
  const limit = event.participantLimit
  if (!limit || limit <= 0) return false

  return countGoingRsvps(event.guestRsvps) >= limit
}

/** Разрешает «going», если пользователь уже идёт или остались свободные места. */
export function canSetGoingRsvp(
  event: Pick<GalleryEvent, 'participantLimit' | 'guestRsvps'>,
  options: { userId?: string; participantId?: string },
) {
  const limit = event.participantLimit
  if (!limit || limit <= 0) return true

  const existing = findUserRsvpEntry(event.guestRsvps, options.userId, options.participantId)
  if (existing?.status === 'going') return true

  return countGoingRsvps(event.guestRsvps) < limit
}

export const EVENT_CAPACITY_FULL_MESSAGE = 'Все места на это событие уже заняты.'
