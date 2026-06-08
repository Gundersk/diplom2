/**
 * Загрузка бинарных файлов в Appwrite Storage (только appwrite mode).
 * Бакеты: eventVisuals (обложка/фон), eventPhotos (снимки альбома и аватары).
 * Local mode использует localBlobStorage / data URL без этого сервиса.
 */
import { Permission, Role } from 'appwrite'
import { APPWRITE_BUCKETS } from '../config/appwriteSchema'
import { hasAppwriteRuntimeConfig } from '../config/runtime'
import { appwriteId, appwriteStorage } from '../lib/appwrite'
import { authService } from './authService'
import { isAppwriteMode } from './adapters/dataMode'

export type EventVisualKind = 'cover' | 'background'
export type EventStorageAssetKind = EventVisualKind | 'photo' | 'avatar'

const ALLOWED_AVATAR_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/avif',
  'image/jfif',
])

const MAX_AVATAR_BYTES = 3 * 1024 * 1024

// --- Проверка конфигурации Appwrite Storage ---
function assertAppwriteStorageReady(methodName: string) {
  if (!hasAppwriteRuntimeConfig()) {
    const message =
      `[storageService] ${methodName} requires Appwrite runtime config and an existing storage bucket.`
    console.error(message)
    throw new Error('Appwrite mode is enabled, but the storage adapter is not configured yet.')
  }
}

export const storageService = {
  // --- Обложка и фон события (бакет eventVisuals) ---
  async uploadEventVisual(file: File, kind: EventVisualKind): Promise<{ fileId: string; previewUrl: string }> {
    if (!isAppwriteMode()) {
      throw new Error('uploadEventVisual is available only in appwrite mode.')
    }

    assertAppwriteStorageReady('uploadEventVisual')

    const currentUser = await authService.getCurrentUser()
    if (!currentUser?.id) {
      throw new Error('Нужно войти в аккаунт, чтобы загрузить визуал события.')
    }

    const uploadedFile = await appwriteStorage.createFile(
      APPWRITE_BUCKETS.eventVisuals,
      appwriteId.unique(),
      file,
      [
        Permission.read(Role.users()),
        Permission.update(Role.user(currentUser.id)),
        Permission.delete(Role.user(currentUser.id)),
      ],
    )

    return {
      fileId: uploadedFile.$id,
      previewUrl: this.getFilePreviewUrl(uploadedFile.$id, kind),
    }
  },

  getFilePreviewUrl(fileId: string, kind: EventVisualKind = 'cover'): string {
    assertAppwriteStorageReady('getFilePreviewUrl')

    if (kind === 'background') {
      return appwriteStorage.getFileView(APPWRITE_BUCKETS.eventVisuals, fileId)
    }

    return appwriteStorage.getFileView(APPWRITE_BUCKETS.eventVisuals, fileId)
  },

  // --- Фото альбома и аватар (бакет eventPhotos) ---
  async uploadEventPhoto(file: File): Promise<{ fileId: string; viewUrl: string }> {
    if (!isAppwriteMode()) {
      throw new Error('uploadEventPhoto is available only in appwrite mode.')
    }

    assertAppwriteStorageReady('uploadEventPhoto')

    const currentUser = await authService.getCurrentUser()
    if (!currentUser?.id) {
      throw new Error('Нужно войти в аккаунт, чтобы загрузить фото события.')
    }

    const uploadedFile = await appwriteStorage.createFile(
      APPWRITE_BUCKETS.eventPhotos,
      appwriteId.unique(),
      file,
      [
        Permission.read(Role.users()),
        Permission.update(Role.user(currentUser.id)),
        Permission.delete(Role.user(currentUser.id)),
      ],
    )

    return {
      fileId: uploadedFile.$id,
      viewUrl: this.getEventPhotoViewUrl(uploadedFile.$id),
    }
  },

  getEventPhotoViewUrl(fileId: string): string {
    assertAppwriteStorageReady('getEventPhotoViewUrl')
    return appwriteStorage.getFileView(APPWRITE_BUCKETS.eventPhotos, fileId)
  },

  async uploadUserAvatar(file: File): Promise<{ fileId: string; previewUrl: string }> {
    if (!isAppwriteMode()) {
      throw new Error('uploadUserAvatar is available only in appwrite mode.')
    }

    assertAppwriteStorageReady('uploadUserAvatar')

    if (!ALLOWED_AVATAR_MIME_TYPES.has(file.type)) {
      throw new Error('Поддерживаются PNG, JPEG, WEBP, GIF, AVIF и JFIF.')
    }

    if (file.size > MAX_AVATAR_BYTES) {
      throw new Error('Файл аватара должен быть не больше 3 МБ.')
    }

    const currentUser = await authService.getCurrentUser()
    if (!currentUser?.id) {
      throw new Error('Нужно войти в аккаунт, чтобы загрузить аватар.')
    }

    const uploadedFile = await appwriteStorage.createFile(
      APPWRITE_BUCKETS.eventPhotos,
      appwriteId.unique(),
      file,
      [
        Permission.read(Role.users()),
        Permission.update(Role.user(currentUser.id)),
        Permission.delete(Role.user(currentUser.id)),
      ],
    )

    return {
      fileId: uploadedFile.$id,
      previewUrl: this.getEventPhotoViewUrl(uploadedFile.$id),
    }
  },

  async deleteFile(fileId: string): Promise<void> {
    if (!isAppwriteMode()) return

    assertAppwriteStorageReady('deleteFile')
    await appwriteStorage.deleteFile(APPWRITE_BUCKETS.eventVisuals, fileId)
  },

  async deleteEventPhotoFile(fileId: string): Promise<void> {
    if (!isAppwriteMode()) return

    assertAppwriteStorageReady('deleteEventPhotoFile')
    await appwriteStorage.deleteFile(APPWRITE_BUCKETS.eventPhotos, fileId)
  },
}
