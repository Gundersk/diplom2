import { eventService } from './eventService'
import type { GalleryPhoto } from '../types/photo'

const PHOTO_STORAGE_KEY = 'event-gallery:photos'
const DEFAULT_PHOTO_TONE = '#ffffff,#d9e8ff,#5b8def'

function canUseLocalStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function createId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

function readStoredPhotos(): GalleryPhoto[] {
  if (!canUseLocalStorage()) return []

  const raw = window.localStorage.getItem(PHOTO_STORAGE_KEY)
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      throw new Error('Stored photos payload is not an array.')
    }

    return parsed.map((photo) => normalizePhoto(photo as GalleryPhoto))
  } catch {
    window.localStorage.removeItem(PHOTO_STORAGE_KEY)
    return []
  }
}

function persistPhotos(photos: GalleryPhoto[]) {
  if (!canUseLocalStorage()) return

  window.localStorage.setItem(
    PHOTO_STORAGE_KEY,
    JSON.stringify(photos.map((photo) => normalizePhoto(photo))),
  )
}

function uniqueStrings(values?: string[]) {
  return Array.from(new Set((values ?? []).filter((value): value is string => Boolean(value))))
}

function normalizePhoto(photo: GalleryPhoto, fallback?: Partial<GalleryPhoto>): GalleryPhoto {
  const imageUrl = photo.imageUrl ?? photo.src ?? fallback?.imageUrl ?? fallback?.src
  const likesCount = Number(photo.likesCount ?? photo.likes ?? 0) || 0
  const createdAt = photo.createdAt ?? fallback?.createdAt ?? new Date().toISOString()

  return {
    ...photo,
    id: photo.id,
    eventId: photo.eventId ?? fallback?.eventId,
    userId: photo.userId ?? fallback?.userId,
    participantId: photo.participantId ?? fallback?.participantId,
    authorName: photo.authorName ?? fallback?.authorName ?? 'Гость',
    authorAvatarUrl: photo.authorAvatarUrl ?? fallback?.authorAvatarUrl,
    storageFileId: photo.storageFileId ?? fallback?.storageFileId,
    imageUrl,
    caption: photo.caption ?? fallback?.caption ?? '',
    likesCount,
    likedBy: uniqueStrings(photo.likedBy ?? fallback?.likedBy),
    saved: Boolean(photo.saved ?? fallback?.saved),
    badges: uniqueStrings(photo.badges ?? fallback?.badges),
    createdAt,
    updatedAt: photo.updatedAt ?? fallback?.updatedAt,
    tone: photo.tone ?? fallback?.tone ?? DEFAULT_PHOTO_TONE,
    likes: likesCount,
    src: imageUrl ?? photo.src ?? fallback?.src,
  }
}

function migrateEventPhotosIfNeeded(eventId: string) {
  const storedPhotos = readStoredPhotos()
  const eventPhotos = storedPhotos.filter((photo) => photo.eventId === eventId)
  if (eventPhotos.length > 0) {
    return eventPhotos
  }

  const event = eventService.getHomeEvents().find((item) => item.id === eventId)
  if (!event || event.photos.length === 0) {
    return []
  }

  const migratedPhotos = event.photos.map((photo) =>
    normalizePhoto(photo, {
      eventId,
      authorName: event.organizerName,
      createdAt: event.startsAt,
      tone: photo.tone ?? DEFAULT_PHOTO_TONE,
    }),
  )

  persistPhotos([...storedPhotos, ...migratedPhotos])
  return migratedPhotos
}

function updateStoredPhoto(photoId: string, updater: (photo: GalleryPhoto) => GalleryPhoto) {
  const photos = readStoredPhotos()
  const index = photos.findIndex((photo) => photo.id === photoId)
  if (index === -1) {
    throw new Error('Фотография не найдена.')
  }

  const nextPhoto = normalizePhoto(updater(photos[index]), photos[index])
  photos[index] = nextPhoto
  persistPhotos(photos)
  return nextPhoto
}

export const photoService = {
  async getEventPhotos(eventId: string): Promise<GalleryPhoto[]> {
    const storedPhotos = readStoredPhotos().filter((photo) => photo.eventId === eventId)
    if (storedPhotos.length > 0) {
      return storedPhotos
    }

    return migrateEventPhotosIfNeeded(eventId)
  },

  async addEventPhoto(input: {
    eventId: string
    userId: string
    participantId: string
    authorName: string
    authorAvatarUrl?: string
    imageUrl: string
    caption?: string
  }): Promise<GalleryPhoto> {
    const photo = normalizePhoto({
      id: createId('photo'),
      eventId: input.eventId,
      userId: input.userId,
      participantId: input.participantId,
      authorName: input.authorName,
      authorAvatarUrl: input.authorAvatarUrl,
      imageUrl: input.imageUrl,
      caption: input.caption ?? '',
      likesCount: 0,
      likedBy: [],
      saved: false,
      badges: [],
      createdAt: new Date().toISOString(),
      tone: DEFAULT_PHOTO_TONE,
    })

    const nextPhotos = [...readStoredPhotos(), photo]
    persistPhotos(nextPhotos)
    return photo
  },

  async updatePhoto(photoId: string, patch: Partial<GalleryPhoto>): Promise<GalleryPhoto> {
    return updateStoredPhoto(photoId, (photo) => ({
      ...photo,
      ...patch,
      updatedAt: new Date().toISOString(),
    }))
  },

  async deletePhoto(photoId: string): Promise<void> {
    const nextPhotos = readStoredPhotos().filter((photo) => photo.id !== photoId)
    persistPhotos(nextPhotos)
  },

  async togglePhotoLike(photoId: string, userId: string): Promise<GalleryPhoto> {
    return updateStoredPhoto(photoId, (photo) => {
      const likedBy = new Set(uniqueStrings(photo.likedBy))
      const currentLikesCount = Number(photo.likesCount ?? photo.likes ?? 0) || 0
      if (likedBy.has(userId)) {
        likedBy.delete(userId)
      } else {
        likedBy.add(userId)
      }

      const nextLikedBy = [...likedBy]
      const nextLikesCount = likedBy.has(userId)
        ? currentLikesCount + 1
        : Math.max(0, currentLikesCount - 1)

      return {
        ...photo,
        likedBy: nextLikedBy,
        likesCount: nextLikesCount,
        likes: nextLikesCount,
        updatedAt: new Date().toISOString(),
      }
    })
  },

  async togglePhotoSaved(photoId: string): Promise<GalleryPhoto> {
    return updateStoredPhoto(photoId, (photo) => ({
      ...photo,
      saved: !photo.saved,
      updatedAt: new Date().toISOString(),
    }))
  },

  async addPhotoBadge(photoId: string, badge: string): Promise<GalleryPhoto> {
    return updateStoredPhoto(photoId, (photo) => ({
      ...photo,
      badges: uniqueStrings([...(photo.badges ?? []), badge]),
      updatedAt: new Date().toISOString(),
    }))
  },

  async removePhotoBadge(photoId: string, badge: string): Promise<GalleryPhoto> {
    return updateStoredPhoto(photoId, (photo) => ({
      ...photo,
      badges: (photo.badges ?? []).filter((item) => item !== badge),
      updatedAt: new Date().toISOString(),
    }))
  },
}

// TODO: replace localStorage imageUrl with Appwrite Storage fileId.
