/**
 * Модель фотографии в галерее события.
 */
export type GalleryPhoto = {
  id: string
  eventId?: string
  userId?: string
  participantId?: string
  authorName?: string
  authorAvatarUrl?: string
  storageFileId?: string
  imageUrl?: string
  caption?: string
  /** Устаревшие поля лайков; в UI не используются, оставлены для совместимости со старыми данными. */
  likesCount?: number
  likedBy?: string[]
  /** Флаг «сохранено» в UI; постоянное состояние — в savedPhotoService. */
  saved?: boolean
  badges?: string[]
  createdAt?: string
  updatedAt?: string
  tone?: string
  likes?: number
  src?: string
}
