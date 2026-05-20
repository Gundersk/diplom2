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
  likesCount?: number
  likedBy?: string[]
  saved?: boolean
  badges?: string[]
  createdAt?: string
  updatedAt?: string
  tone?: string
  likes?: number
  src?: string
}
