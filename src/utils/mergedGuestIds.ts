/**
 * Реестр слияния гостевых userId с профилем после входа.
 * Хранится в localStorage; позволяет сопоставить старые гостевые id с текущим пользователем.
 */
const MERGED_GUEST_IDS_STORAGE_KEY = 'event-gallery:merged-guest-user-ids'
const MERGED_GUEST_PROFILE_MAP_KEY = 'event-gallery:merged-guest-profile-map'

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

export function readMergedGuestProfileMap(): Record<string, string> {
  if (!canUseLocalStorage()) return {}

  const raw = window.localStorage.getItem(MERGED_GUEST_PROFILE_MAP_KEY)
  if (!raw) return {}

  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {}
    }

    return Object.fromEntries(
      Object.entries(parsed).filter(
        ([guestUserId, profileUserId]) =>
          typeof guestUserId === 'string' &&
          guestUserId.trim() &&
          typeof profileUserId === 'string' &&
          profileUserId.trim(),
      ),
    ) as Record<string, string>
  } catch {
    window.localStorage.removeItem(MERGED_GUEST_PROFILE_MAP_KEY)
    return {}
  }
}

export function rememberMergedGuestUserId(guestUserId: string, profileUserId?: string) {
  if (!canUseLocalStorage() || !guestUserId.trim()) return

  const normalizedGuestUserId = guestUserId.trim()
  const nextIds = [...new Set([...readMergedGuestUserIds(), normalizedGuestUserId])]
  window.localStorage.setItem(MERGED_GUEST_IDS_STORAGE_KEY, JSON.stringify(nextIds))

  if (profileUserId?.trim()) {
    const nextMap = {
      ...readMergedGuestProfileMap(),
      [normalizedGuestUserId]: profileUserId.trim(),
    }
    window.localStorage.setItem(MERGED_GUEST_PROFILE_MAP_KEY, JSON.stringify(nextMap))
  }
}

export function isMergedGuestUserId(userId: string) {
  return readMergedGuestUserIds().includes(userId)
}

export function getMergedGuestIdsForProfile(profileUserId: string) {
  if (!profileUserId.trim()) return [] as string[]

  const normalizedProfileUserId = profileUserId.trim()
  const guestIds = new Set<string>()
  const profileMap = readMergedGuestProfileMap()

  for (const [guestUserId, mappedProfileUserId] of Object.entries(profileMap)) {
    if (mappedProfileUserId === normalizedProfileUserId) {
      guestIds.add(guestUserId)
    }
  }

  return [...guestIds]
}

/** Подменяет слитый гостевой id на id текущего профиля. */
export function resolveCanonicalUserId(userId: string, currentUserId: string) {
  if (!userId) return userId
  if (userId === currentUserId) return currentUserId
  if (isMergedGuestUserId(userId)) return currentUserId
  return userId
}
