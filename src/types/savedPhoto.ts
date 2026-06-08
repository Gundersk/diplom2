/**
 * Запись о фото, сохранённом пользователем в личную коллекцию.
 */
export type SavedPhoto = {
  id: string
  userId: string
  photoId: string
  eventId: string
  participantId?: string
  savedAt: string
  createdAt?: string
}
