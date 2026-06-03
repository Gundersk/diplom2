import type { EventParticipant } from '../types/participant'
import { resolveCanonicalUserId } from './mergedGuestIds'

export function dedupeEventParticipants(participants: EventParticipant[], currentUserId: string) {
  const groups = new Map<string, EventParticipant[]>()

  for (const participant of participants) {
    const canonicalUserId = resolveCanonicalUserId(participant.userId, currentUserId)
    const bucket = groups.get(canonicalUserId) ?? []
    bucket.push(participant)
    groups.set(canonicalUserId, bucket)
  }

  const deduped: EventParticipant[] = []

  for (const [canonicalUserId, bucket] of groups) {
    if (bucket.length === 1) {
      deduped.push(
        canonicalUserId === bucket[0].userId
          ? bucket[0]
          : { ...bucket[0], userId: canonicalUserId },
      )
      continue
    }

    const preferred =
      bucket.find((item) => item.userId === canonicalUserId && item.role === 'organizer') ??
      bucket.find((item) => item.userId === canonicalUserId) ??
      bucket.find((item) => item.role === 'organizer') ??
      [...bucket].sort((left, right) =>
        (right.updatedAt ?? right.joinedAt).localeCompare(left.updatedAt ?? left.joinedAt),
      )[0]

    deduped.push({ ...preferred, userId: canonicalUserId })
  }

  return deduped.sort((left, right) => left.displayName.localeCompare(right.displayName, 'ru'))
}
