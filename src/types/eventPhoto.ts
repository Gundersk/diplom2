/**
 * Связь фотографии с событием (таблица event_photos в Appwrite).
 */
export type EventPhotoLink = {
  id: string
  eventId: string
  photoId: string
  addedAt: string
  addedByUserId?: string
  addedByParticipantId?: string
}
