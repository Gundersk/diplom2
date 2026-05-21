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
  // likesCount/likedBy are legacy fallback fields. MVP uses photo comments instead of likes.
  likesCount?: number
  likedBy?: string[]
  // saved is UI-derived. Persistent personal gallery state lives in savedPhotoService.
  saved?: boolean
  badges?: string[]
  createdAt?: string
  updatedAt?: string
  tone?: string
  likes?: number
  src?: string
}
