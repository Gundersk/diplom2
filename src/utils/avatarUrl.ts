/**
 * Разрешение URL аватара с учётом режима данных.
 * В Appwrite — через fileId; локально — blob/data URL или ссылка idb://.
 */
import { APPWRITE_BUCKETS } from '../config/appwriteSchema'
import { appwriteStorage } from '../lib/appwrite'
import { isAppwriteMode } from '../services/adapters/dataMode'
import { getCachedLocalBlobUrl, isLocalBlobRef } from './localBlobStorage'
import { sanitizePersistableUrl } from './persistableUrl'

export function resolveAvatarViewUrl(avatarUrl?: string, avatarFileId?: string) {
  if (isAppwriteMode() && avatarFileId) {
    return appwriteStorage.getFileView(APPWRITE_BUCKETS.eventPhotos, avatarFileId)
  }

  if (!isAppwriteMode()) {
    if (avatarUrl?.startsWith('blob:') || avatarUrl?.startsWith('data:')) {
      return avatarUrl
    }

    if (isLocalBlobRef(avatarUrl)) {
      return getCachedLocalBlobUrl(avatarUrl)
    }
  }

  return sanitizePersistableUrl(avatarUrl) || undefined
}

/** Добавляет query-параметр v= для сброса кэша браузера после обновления аватара. */
export function withAvatarCacheToken(url: string, token?: string) {
  if (!token) return url
  if (url.startsWith('blob:') || url.startsWith('data:')) {
    return url
  }

  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}v=${encodeURIComponent(token)}`
}
