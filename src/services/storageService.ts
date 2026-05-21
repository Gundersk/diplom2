import { Permission, Role } from 'appwrite'
import { APPWRITE_BUCKETS } from '../config/appwriteSchema'
import { hasAppwriteRuntimeConfig } from '../config/runtime'
import { appwriteId, appwriteStorage } from '../lib/appwrite'
import { authService } from './authService'
import { isAppwriteMode } from './adapters/dataMode'

export type EventVisualKind = 'cover' | 'background'

function assertAppwriteStorageReady(methodName: string) {
  if (!hasAppwriteRuntimeConfig()) {
    const message =
      `[storageService] ${methodName} requires Appwrite runtime config and an existing storage bucket.`
    console.error(message)
    throw new Error('Appwrite mode is enabled, but the storage adapter is not configured yet.')
  }
}

export const storageService = {
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

  async deleteFile(fileId: string): Promise<void> {
    if (!isAppwriteMode()) return

    assertAppwriteStorageReady('deleteFile')
    await appwriteStorage.deleteFile(APPWRITE_BUCKETS.eventVisuals, fileId)
  },
}
