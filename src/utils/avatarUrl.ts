import { APPWRITE_BUCKETS } from '../config/appwriteSchema'
import { appwriteStorage } from '../lib/appwrite'
import { isAppwriteMode } from '../services/adapters/dataMode'
import { sanitizePersistableUrl } from './persistableUrl'

export function resolveAvatarViewUrl(avatarUrl?: string, avatarFileId?: string) {
  if (isAppwriteMode() && avatarFileId) {
    return appwriteStorage.getFileView(APPWRITE_BUCKETS.eventPhotos, avatarFileId)
  }

  return sanitizePersistableUrl(avatarUrl) || undefined
}

export function withAvatarCacheToken(url: string, token?: string) {
  if (!token) return url
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}v=${encodeURIComponent(token)}`
}
