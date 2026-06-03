// TODO: replace localStorage imageUrl with Appwrite Storage fileId.
// saved is UI-derived. Persistent personal gallery state lives in savedPhotoService.
// likesCount/likedBy are legacy fallback fields. MVP uses photo comments instead of likes.

import type { Models } from 'appwrite'
import { Permission, Role } from 'appwrite'
import { APPWRITE_COLLECTIONS, APPWRITE_DATABASE_ID } from '../config/appwriteSchema'
import { hasAppwriteRuntimeConfig } from '../config/runtime'
import { appwriteDatabases, appwriteId, appwriteQuery } from '../lib/appwrite'
import type { EventPhotoLink } from '../types/eventPhoto'
import type { GalleryPhoto } from '../types/photo'
import { sanitizePersistableUrl } from '../utils/persistableUrl'
import { isAppwriteMode } from './adapters/dataMode'
import { eventService } from './eventService'
import { photoCommentService } from './photoCommentService'
import { savedPhotoService } from './savedPhotoService'
import { storageService } from './storageService'

const PHOTO_STORAGE_KEY = 'event-gallery:photos'
const DEFAULT_PHOTO_TONE = '#ffffff,#d9e8ff,#5b8def'

type PhotoDocument = Models.Document & {
  eventId: string
  userId: string
  participantId: string
  authorName: string
  authorAvatarUrl?: string
  storageFileId: string
  imageUrl: string
  caption?: string
  likesCount?: number
  badgesJson?: string
  createdAt: string
  updatedAt?: string
}

function canUseLocalStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function createId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

function assertAppwriteReady(methodName: string) {
  if (!hasAppwriteRuntimeConfig() || !APPWRITE_DATABASE_ID) {
    const message =
      `[photoService] ${methodName} requires Appwrite runtime config and an existing photos collection.`
    console.error(message)
    throw new Error('Appwrite mode is enabled, but the photo adapter is not configured yet.')
  }
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

function parseBadgesJson(value?: string) {
  if (!value) return []

  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? uniqueStrings(parsed as string[]) : []
  } catch {
    return []
  }
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

function normalizePhotoDocument(document: PhotoDocument): GalleryPhoto {
  const imageUrl = document.imageUrl || storageService.getEventPhotoViewUrl(document.storageFileId)

  return normalizePhoto({
    id: document.$id,
    eventId: document.eventId,
    userId: document.userId,
    participantId: document.participantId,
    authorName: document.authorName,
    authorAvatarUrl: document.authorAvatarUrl,
    storageFileId: document.storageFileId,
    imageUrl,
    caption: document.caption ?? '',
    likesCount: Number(document.likesCount ?? 0) || 0,
    badges: parseBadgesJson(document.badgesJson),
    createdAt: document.createdAt ?? document.$createdAt,
    updatedAt: document.updatedAt ?? document.$updatedAt ?? document.$createdAt,
    tone: DEFAULT_PHOTO_TONE,
  })
}

async function listPhotoDocuments(eventId: string) {
  const response = await appwriteDatabases.listDocuments<PhotoDocument>(
    APPWRITE_DATABASE_ID,
    APPWRITE_COLLECTIONS.photos,
    [
      appwriteQuery.equal('eventId', eventId),
      appwriteQuery.limit(5000),
      appwriteQuery.orderAsc('createdAt'),
    ],
  )

  return response.documents
}

async function getPhotoDocument(photoId: string) {
  return appwriteDatabases.getDocument<PhotoDocument>(
    APPWRITE_DATABASE_ID,
    APPWRITE_COLLECTIONS.photos,
    photoId,
  )
}

async function migrateEventPhotosIfNeeded(eventId: string) {
  const storedPhotos = readStoredPhotos()
  const eventPhotos = storedPhotos.filter((photo) => photo.eventId === eventId)
  if (eventPhotos.length > 0) {
    return eventPhotos
  }

  const events = await eventService.getHomeEvents()
  const event = events.find((item) => item.id === eventId)
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

async function getEventPhotoLinksFromEvents(photoId: string): Promise<EventPhotoLink[]> {
  const events = await eventService.getHomeEvents()

  return events
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

async function getSavedPhotosOverlay(userId?: string) {
  if (!userId) {
    return new Set<string>()
  }

  return new Set(await savedPhotoService.getUserSavedPhotoIds(userId))
}

export const photoService = {
  async getEventPhotos(eventId: string, userId?: string): Promise<GalleryPhoto[]> {
    if (!isAppwriteMode()) {
      const storedPhotos = readStoredPhotos().filter((photo) => photo.eventId === eventId)
      const eventPhotos = storedPhotos.length > 0 ? storedPhotos : await migrateEventPhotosIfNeeded(eventId)

      if (!userId) {
        return eventPhotos
      }

      const savedPhotoIds = await getSavedPhotosOverlay(userId)
      return eventPhotos.map((photo) =>
        normalizePhoto({
          ...photo,
          saved: savedPhotoIds.has(photo.id),
        }, photo),
      )
    }

    assertAppwriteReady('getEventPhotos')
    const [documents, savedPhotoIds] = await Promise.all([
      listPhotoDocuments(eventId),
      getSavedPhotosOverlay(userId),
    ])

    return documents.map((document) =>
      normalizePhoto({
        ...normalizePhotoDocument(document),
        saved: savedPhotoIds.has(document.$id),
      }),
    )
  },

  async addEventPhoto(input: {
    eventId: string
    userId: string
    participantId: string
    authorName: string
    authorAvatarUrl?: string
    imageUrl?: string
    caption?: string
    file?: File
  }): Promise<GalleryPhoto> {
    if (!isAppwriteMode()) {
      if (!input.imageUrl) {
        throw new Error('Для local mode нужен imageUrl.')
      }

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
    }

    assertAppwriteReady('addEventPhoto')
    if (!input.file) {
      throw new Error('Для appwrite mode нужен исходный файл фотографии.')
    }

    const uploadedFile = await storageService.uploadEventPhoto(input.file)
    const now = new Date().toISOString()
    const created = await appwriteDatabases.createDocument<PhotoDocument>(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTIONS.photos,
      appwriteId.unique(),
      {
        eventId: input.eventId,
        userId: input.userId,
        participantId: input.participantId,
        authorName: input.authorName,
        authorAvatarUrl: sanitizePersistableUrl(input.authorAvatarUrl),
        storageFileId: uploadedFile.fileId,
        imageUrl: uploadedFile.viewUrl,
        caption: input.caption ?? '',
        likesCount: 0,
        badgesJson: JSON.stringify([]),
        createdAt: now,
        updatedAt: now,
      },
      [
        Permission.read(Role.users()),
        Permission.update(Role.user(input.userId)),
        Permission.delete(Role.user(input.userId)),
      ],
    )

    return normalizePhotoDocument(created)
  },

  async updatePhoto(photoId: string, patch: Partial<GalleryPhoto>): Promise<GalleryPhoto> {
    if (!isAppwriteMode()) {
      return updateStoredPhoto(photoId, (photo) => ({
        ...photo,
        ...patch,
        updatedAt: new Date().toISOString(),
      }))
    }

    assertAppwriteReady('updatePhoto')
    const existing = await getPhotoDocument(photoId)
    const updated = await appwriteDatabases.updateDocument<PhotoDocument>(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTIONS.photos,
      photoId,
      {
        authorName: patch.authorName ?? existing.authorName,
        authorAvatarUrl: sanitizePersistableUrl(patch.authorAvatarUrl ?? existing.authorAvatarUrl),
        imageUrl: patch.imageUrl ?? existing.imageUrl,
        caption: patch.caption ?? existing.caption ?? '',
        likesCount: Number(patch.likesCount ?? existing.likesCount ?? 0) || 0,
        badgesJson: JSON.stringify(uniqueStrings(patch.badges ?? parseBadgesJson(existing.badgesJson))),
        updatedAt: new Date().toISOString(),
      },
    )

    return normalizePhotoDocument(updated)
  },

  async deletePhoto(photoId: string): Promise<void> {
    if (!isAppwriteMode()) {
      await this.deletePhotoIfUnreferenced(photoId)
      return
    }

    assertAppwriteReady('deletePhoto')
    const photo = await getPhotoDocument(photoId)
    await appwriteDatabases.deleteDocument(APPWRITE_DATABASE_ID, APPWRITE_COLLECTIONS.photos, photoId)
    await photoCommentService.deleteCommentsForPhoto(photoId)

    if (photo.storageFileId) {
      try {
        await storageService.deleteEventPhotoFile(photo.storageFileId)
      } catch (error) {
        console.warn('[photoService] Failed to delete photo storage file.', error)
      }
    }
  },

  async togglePhotoLike(photoId: string, userId: string): Promise<GalleryPhoto> {
    if (!isAppwriteMode()) {
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
    }

    const existing = await getPhotoDocument(photoId)
    const currentLikesCount = Number(existing.likesCount ?? 0) || 0
    const updated = await appwriteDatabases.updateDocument<PhotoDocument>(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTIONS.photos,
      photoId,
      {
        likesCount: currentLikesCount + 1,
        updatedAt: new Date().toISOString(),
      },
    )

    return normalizePhotoDocument(updated)
  },

  async togglePhotoSaved(photoId: string): Promise<GalleryPhoto> {
    return updateStoredPhoto(photoId, (photo) => ({
      ...photo,
      saved: !photo.saved,
      updatedAt: new Date().toISOString(),
    }))
  },

  async addPhotoBadge(photoId: string, badge: string): Promise<GalleryPhoto> {
    if (!isAppwriteMode()) {
      return updateStoredPhoto(photoId, (photo) => ({
        ...photo,
        badges: uniqueStrings([...(photo.badges ?? []), badge]),
        updatedAt: new Date().toISOString(),
      }))
    }

    const existing = await getPhotoDocument(photoId)
    const badges = uniqueStrings([...parseBadgesJson(existing.badgesJson), badge])
    const updated = await appwriteDatabases.updateDocument<PhotoDocument>(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTIONS.photos,
      photoId,
      {
        badgesJson: JSON.stringify(badges),
        updatedAt: new Date().toISOString(),
      },
    )

    return normalizePhotoDocument(updated)
  },

  async removePhotoBadge(photoId: string, badge: string): Promise<GalleryPhoto> {
    if (!isAppwriteMode()) {
      return updateStoredPhoto(photoId, (photo) => ({
        ...photo,
        badges: (photo.badges ?? []).filter((item) => item !== badge),
        updatedAt: new Date().toISOString(),
      }))
    }

    const existing = await getPhotoDocument(photoId)
    const badges = parseBadgesJson(existing.badgesJson).filter((item) => item !== badge)
    const updated = await appwriteDatabases.updateDocument<PhotoDocument>(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTIONS.photos,
      photoId,
      {
        badgesJson: JSON.stringify(badges),
        updatedAt: new Date().toISOString(),
      },
    )

    return normalizePhotoDocument(updated)
  },

  async getPhotoById(photoId: string): Promise<GalleryPhoto | null> {
    if (!isAppwriteMode()) {
      const storedPhoto = readStoredPhotos().find((photo) => photo.id === photoId)
      if (storedPhoto) {
        return storedPhoto
      }

      for (const event of await eventService.getHomeEvents()) {
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
    }

    try {
      assertAppwriteReady('getPhotoById')
      const document = await getPhotoDocument(photoId)
      return normalizePhotoDocument(document)
    } catch (error) {
      console.warn('[photoService] Failed to load photo by id.', error)
      return null
    }
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
    const eventLinksCount = (await getEventPhotoLinksFromEvents(photoId)).length
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

    if (!isAppwriteMode()) {
      const nextPhotos = readStoredPhotos().filter((photo) => photo.id !== photoId)
      persistPhotos(nextPhotos)
      return
    }

    try {
      const photo = await getPhotoDocument(photoId)
      await appwriteDatabases.deleteDocument(APPWRITE_DATABASE_ID, APPWRITE_COLLECTIONS.photos, photoId)
      if (photo.storageFileId) {
        await storageService.deleteEventPhotoFile(photo.storageFileId)
      }
    } catch (error) {
      console.warn('[photoService] Failed to clean orphan photo.', error)
    }
  },

  async deletePhotoIfUnreferenced(photoId: string): Promise<void> {
    // TODO Appwrite:
    // When using Storage, delete the physical file only after both event_photos and saved_photos have no references to photoId.
    await this.cleanupOrphanPhoto(photoId)
  },
}
