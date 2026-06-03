const MERGED_GUEST_IDS_STORAGE_KEY = 'event-gallery:merged-guest-user-ids'

function canUseLocalStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

export function readMergedGuestUserIds(): string[] {
  if (!canUseLocalStorage()) return []

  const raw = window.localStorage.getItem(MERGED_GUEST_IDS_STORAGE_KEY)
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string' && item.trim()) : []
  } catch {
    window.localStorage.removeItem(MERGED_GUEST_IDS_STORAGE_KEY)
    return []
  }
}

export function rememberMergedGuestUserId(guestUserId: string) {
  if (!canUseLocalStorage() || !guestUserId.trim()) return

  const nextIds = [...new Set([...readMergedGuestUserIds(), guestUserId.trim()])]
  window.localStorage.setItem(MERGED_GUEST_IDS_STORAGE_KEY, JSON.stringify(nextIds))
}

export function isMergedGuestUserId(userId: string) {
  return readMergedGuestUserIds().includes(userId)
}

export function resolveCanonicalUserId(userId: string, currentUserId: string) {
  if (!userId) return userId
  if (userId === currentUserId) return currentUserId
  if (isMergedGuestUserId(userId)) return currentUserId
  return userId
}
