import type { EventRsvpEntry } from '../types/rsvp'
import { resolveCanonicalUserId } from './mergedGuestIds'

function getRsvpGroupKey(entry: EventRsvpEntry, currentUserId: string) {
  if (entry.userId) {
    return resolveCanonicalUserId(entry.userId, currentUserId)
  }

  return `participant:${entry.participantId}`
}

function normalizeRsvpForGroup(entry: EventRsvpEntry, groupKey: string, currentUserId: string) {
  if (entry.userId && groupKey === currentUserId) {
    return { ...entry, userId: currentUserId }
  }

  return entry
}

export function dedupeRsvpEntries(entries: EventRsvpEntry[], currentUserId: string) {
  const map = new Map<string, EventRsvpEntry>()

  for (const entry of entries) {
    const groupKey = getRsvpGroupKey(entry, currentUserId)
    const existing = map.get(groupKey)

    if (!existing) {
      map.set(groupKey, normalizeRsvpForGroup(entry, groupKey, currentUserId))
      continue
    }

    const preferCurrent = Boolean(entry.userId && entry.userId === currentUserId && existing.userId !== currentUserId)
    const preferNewer =
      !preferCurrent &&
      new Date(entry.updatedAt ?? entry.createdAt).getTime() >
        new Date(existing.updatedAt ?? existing.createdAt).getTime()

    if (preferCurrent || preferNewer) {
      map.set(groupKey, normalizeRsvpForGroup(entry, groupKey, currentUserId))
    }
  }

  return [...map.values()]
}
