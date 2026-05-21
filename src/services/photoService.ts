// TODO: add Appwrite implementation when VITE_DATA_MODE=appwrite
// TODO: replace localStorage imageUrl with Appwrite Storage fileId.
// saved is UI-derived. Persistent personal gallery state lives in savedPhotoService.

import { eventService } from './eventService'
import { photoCommentService } from './photoCommentService'
import { savedPhotoService } from './savedPhotoService'
import type { EventPhotoLink } from '../types/eventPhoto'
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

function getEventPhotoLinksFromEvents(photoId: string): EventPhotoLink[] {
  return eventService
    .getHomeEvents()
    .filter((event) => event.photos.some((photo) => photo.id === photoId))
    .map((event) => {
      const photo = event.photos.find((entry) => entry.id === photoId)
      return {
        id: `event-photo-${event.id}-${photoId}`,
        eventId: event.id,
        photoId,
        addedAt: photo?.createdAt ?? event.startsAt,
        addedByUserId: photo?.userId,
        addedByParticipantId: photo?.participantId,
      }
    })
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
  async getEventPhotos(eventId: string, userId?: string): Promise<GalleryPhoto[]> {
    const storedPhotos = readStoredPhotos().filter((photo) => photo.eventId === eventId)
    const eventPhotos = storedPhotos.length > 0 ? storedPhotos : migrateEventPhotosIfNeeded(eventId)

    if (!userId) {
      return eventPhotos
    }

    const savedPhotoIds = new Set(await savedPhotoService.getUserSavedPhotoIds(userId))
    return eventPhotos.map((photo) =>
      normalizePhoto({
        ...photo,
        saved: savedPhotoIds.has(photo.id),
      }, photo),
    )
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
    await this.deletePhotoIfUnreferenced(photoId)
  },

  // Legacy fallback: MVP now uses photo comments instead of building a like-based mechanic.
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

  // Deprecated: persistent saved state should be managed via savedPhotoService.
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

  async getPhotoById(photoId: string): Promise<GalleryPhoto | null> {
    const storedPhoto = readStoredPhotos().find((photo) => photo.id === photoId)
    if (storedPhoto) {
      return storedPhoto
    }

    for (const event of eventService.getHomeEvents()) {
      const eventPhoto = event.photos.find((photo) => photo.id === photoId)
      if (eventPhoto) {
        return normalizePhoto(eventPhoto, {
          eventId: event.id,
          authorName: event.organizerName,
          createdAt: event.startsAt,
          tone: eventPhoto.tone ?? DEFAULT_PHOTO_TONE,
        })
      }
    }

    return null
  },

  async getPhotosByIds(photoIds: string[], userId?: string): Promise<GalleryPhoto[]> {
    const uniqueIds = uniqueStrings(photoIds)
    const savedPhotoIds = userId
      ? new Set(await savedPhotoService.getUserSavedPhotoIds(userId))
      : new Set<string>()
    const photos = await Promise.all(uniqueIds.map((photoId) => this.getPhotoById(photoId)))

    return photos
      .filter((photo): photo is GalleryPhoto => Boolean(photo))
      .map((photo) =>
        userId
          ? normalizePhoto({
              ...photo,
              saved: savedPhotoIds.has(photo.id),
            }, photo)
          : photo,
      )
  },

  async getUserSavedGallery(userId: string): Promise<GalleryPhoto[]> {
    const savedPhotoIds = await savedPhotoService.getUserSavedPhotoIds(userId)
    return this.getPhotosByIds(savedPhotoIds, userId)
  },

  async getPhotoUsage(photoId: string): Promise<{
    eventLinksCount: number
    savedLinksCount: number
    canDeletePhysicalPhoto: boolean
  }> {
    const eventLinksCount = getEventPhotoLinksFromEvents(photoId).length
    const savedLinksCount = await savedPhotoService.getSavedLinksCount(photoId)

    return {
      eventLinksCount,
      savedLinksCount,
      canDeletePhysicalPhoto: eventLinksCount === 0 && savedLinksCount === 0,
    }
  },

  async cleanupOrphanPhoto(photoId: string): Promise<void> {
    const usage = await this.getPhotoUsage(photoId)
    if (!usage.canDeletePhysicalPhoto) {
      return
    }

    await photoCommentService.deleteCommentsForPhoto(photoId)
    const nextPhotos = readStoredPhotos().filter((photo) => photo.id !== photoId)
    persistPhotos(nextPhotos)
  },

  async deletePhotoIfUnreferenced(photoId: string): Promise<void> {
    // TODO Appwrite:
    // When using Storage, delete the physical file only after both event_photos and saved_photos have no references to photoId.
    await this.cleanupOrphanPhoto(photoId)
  },
}

// TODO: replace localStorage imageUrl with Appwrite Storage fileId.
