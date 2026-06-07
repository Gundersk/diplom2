const PROFILE_EMAIL_REGISTRY_KEY = 'event-gallery:profile-user-by-email'

function canUseLocalStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

export function readProfileEmailRegistry(): Record<string, string> {
  if (!canUseLocalStorage()) return {}

  const raw = window.localStorage.getItem(PROFILE_EMAIL_REGISTRY_KEY)
  if (!raw) return {}

  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {}
    }

    return Object.fromEntries(
      Object.entries(parsed).filter(
        ([email, userId]) =>
          typeof email === 'string' &&
          email.trim() &&
          typeof userId === 'string' &&
          userId.trim(),
      ),
    ) as Record<string, string>
  } catch {
    window.localStorage.removeItem(PROFILE_EMAIL_REGISTRY_KEY)
    return {}
  }
}

export function rememberProfileUserForEmail(email: string, profileUserId: string) {
  if (!canUseLocalStorage() || !email.trim() || !profileUserId.trim()) return

  const normalizedEmail = normalizeEmail(email)
  const nextRegistry = {
    ...readProfileEmailRegistry(),
    [normalizedEmail]: profileUserId.trim(),
  }
  window.localStorage.setItem(PROFILE_EMAIL_REGISTRY_KEY, JSON.stringify(nextRegistry))
}

export function resolveProfileUserIdForEmail(email: string) {
  const normalizedEmail = normalizeEmail(email)
  if (!normalizedEmail) return undefined

  return readProfileEmailRegistry()[normalizedEmail]
}
