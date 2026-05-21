export type PhotoComment = {
  id: string
  photoId: string
  eventId: string
  userId: string
  participantId: string
  authorName: string
  authorAvatarUrl?: string
  text: string
  createdAt: string
  updatedAt?: string
}
