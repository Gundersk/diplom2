// TODO: add Appwrite implementation when VITE_DATA_MODE=appwrite

import { eventService } from './eventService'
import type { SavedPhoto } from '../types/savedPhoto'

const SAVED_PHOTO_STORAGE_KEY = 'event-gallery:saved-photos'
const SAVED_PHOTO_LEGACY_MIGRATION_KEY = 'event-gallery:saved-photos:legacy-migrated'

function canUseLocalStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function createId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

function readStoredSavedPhotos(): SavedPhoto[] {
  if (!canUseLocalStorage()) return []

  const raw = window.localStorage.getItem(SAVED_PHOTO_STORAGE_KEY)
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      throw new Error('Stored saved photos payload is not an array.')
    }

    return parsed
      .filter((entry): entry is SavedPhoto => Boolean(entry?.id && entry?.userId && entry?.photoId && entry?.eventId))
      .map((entry) => ({
        ...entry,
        savedAt: entry.savedAt ?? entry.createdAt ?? new Date().toISOString(),
      }))
  } catch {
    window.localStorage.removeItem(SAVED_PHOTO_STORAGE_KEY)
    return []
  }
}

function persistSavedPhotos(entries: SavedPhoto[]) {
  if (!canUseLocalStorage()) return
  window.localStorage.setItem(SAVED_PHOTO_STORAGE_KEY, JSON.stringify(entries))
}

function isLegacyMigrationDone() {
  if (!canUseLocalStorage()) return false

  const raw = window.localStorage.getItem(SAVED_PHOTO_LEGACY_MIGRATION_KEY)
  if (!raw) return false

  try {
    return JSON.parse(raw) === true
  } catch {
    window.localStorage.removeItem(SAVED_PHOTO_LEGACY_MIGRATION_KEY)
    return false
  }
}

function markLegacyMigrationDone() {
  if (!canUseLocalStorage()) return
  window.localStorage.setItem(SAVED_PHOTO_LEGACY_MIGRATION_KEY, JSON.stringify(true))
}

function migrateUserSavedPhotosIfNeeded(userId: string) {
  const storedEntries = readStoredSavedPhotos()

  if (isLegacyMigrationDone()) {
    return storedEntries.filter((entry) => entry.userId === userId)
  }

  const migratedEntries = eventService
    .getHomeEvents()
    .flatMap((event) =>
      event.photos
        .filter((photo) => photo.saved)
        .map((photo) => ({
          id: createId('saved-photo'),
          userId,
          photoId: photo.id,
          eventId: event.id,
          participantId: photo.participantId,
          savedAt: photo.updatedAt ?? photo.createdAt ?? event.startsAt,
          createdAt: photo.createdAt ?? event.startsAt,
        })),
    )
    .filter(
      (entry, index, entries) =>
        entries.findIndex(
          (candidate) => candidate.userId === entry.userId && candidate.photoId === entry.photoId,
        ) === index,
    )

  markLegacyMigrationDone()

  if (migratedEntries.length === 0) {
    return []
  }

  const nextEntries = [...storedEntries, ...migratedEntries]
  persistSavedPhotos(nextEntries)
  return migratedEntries
}

function ensureUserSavedPhotos(userId: string) {
  const storedEntries = readStoredSavedPhotos().filter((entry) => entry.userId === userId)
  if (storedEntries.length > 0) {
    return storedEntries
  }

  return migrateUserSavedPhotosIfNeeded(userId)
}

function getSavedPhotoLinksByPhotoId(photoId: string) {
  return readStoredSavedPhotos().filter((entry) => entry.photoId === photoId)
}

export const savedPhotoService = {
  async getUserSavedPhotos(userId: string): Promise<SavedPhoto[]> {
    return ensureUserSavedPhotos(userId)
  },

  async getUserSavedPhotoIds(userId: string): Promise<string[]> {
    const entries = await this.getUserSavedPhotos(userId)
    return entries.map((entry) => entry.photoId)
  },

  async isPhotoSaved(userId: string, photoId: string): Promise<boolean> {
    const photoIds = await this.getUserSavedPhotoIds(userId)
    return photoIds.includes(photoId)
  },

  async savePhoto(input: {
    userId: string
    eventId: string
    photoId: string
    participantId?: string
  }): Promise<SavedPhoto> {
    const entries = readStoredSavedPhotos()
    const existing = entries.find(
      (entry) => entry.userId === input.userId && entry.photoId === input.photoId,
    )

    if (existing) {
      return existing
    }

    const nextEntry: SavedPhoto = {
      id: createId('saved-photo'),
      userId: input.userId,
      photoId: input.photoId,
      eventId: input.eventId,
      participantId: input.participantId,
      savedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    }

    markLegacyMigrationDone()
    persistSavedPhotos([...entries, nextEntry])
    return nextEntry
  },

  async unsavePhoto(userId: string, photoId: string): Promise<void> {
    markLegacyMigrationDone()
    persistSavedPhotos(
      readStoredSavedPhotos().filter(
        (entry) => !(entry.userId === userId && entry.photoId === photoId),
      ),
    )
  },

  async toggleSavedPhoto(input: {
    userId: string
    eventId: string
    photoId: string
    participantId?: string
  }): Promise<{ saved: boolean; savedPhoto?: SavedPhoto }> {
    const alreadySaved = await this.isPhotoSaved(input.userId, input.photoId)
    if (alreadySaved) {
      await this.unsavePhoto(input.userId, input.photoId)
      return { saved: false }
    }

    const savedPhoto = await this.savePhoto(input)
    return { saved: true, savedPhoto }
  },

  async getSavedLinksCount(photoId: string): Promise<number> {
    return getSavedPhotoLinksByPhotoId(photoId).length
  },
}
