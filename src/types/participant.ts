/**
 * Участник события: роль, очки и привязка к userId.
 */
export type EventParticipant = {
  id: string
  eventId: string
  userId: string
  displayName: string
  role: 'organizer' | 'guest'
  points: number
  joinedAt: string
  updatedAt?: string
  avatarUrl?: string
  avatarFileId?: string
}
