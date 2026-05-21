import type { Models } from 'appwrite'
import { APPWRITE_COLLECTIONS, APPWRITE_DATABASE_ID } from '../config/appwriteSchema'
import { hasAppwriteAuthConfig } from '../config/runtime'
import { appwriteAccount, appwriteDatabases } from '../lib/appwrite'
import type { CurrentUser } from '../types/user'
import { isAppwriteMode } from './adapters/dataMode'

const CURRENT_USER_STORAGE_KEY = 'event-gallery:current-user'
const EMAIL_CODE_STORAGE_KEY = 'event-gallery:email-codes'
const DEVELOPMENT_EMAIL_CODE = '000000'

type StoredEmailCodes = Record<string, { code: string; requestedAt: string }>

type ProfileDocument = Models.Document & {
  userId: string
  mode: 'guest' | 'profile'
  displayName?: string
  avatarUrl?: string
  createdAt: string
  updatedAt?: string
}

let hasWarnedAboutProfiles = false
let hasWarnedAboutEmailOtp = false

function canUseLocalStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function createId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

function createGuestFallbackName() {
  return `Гость ${Math.floor(1000 + Math.random() * 9000)}`
}

function normalizeDisplayName(name?: string, fallback?: string) {
  const trimmedName = name?.trim()
  if (trimmedName) return trimmedName
  return fallback ?? createGuestFallbackName()
}

function readCurrentUser(): CurrentUser | null {
  if (!canUseLocalStorage()) return null

  const raw = window.localStorage.getItem(CURRENT_USER_STORAGE_KEY)
  if (!raw) return null

  try {
    return JSON.parse(raw) as CurrentUser
  } catch {
    window.localStorage.removeItem(CURRENT_USER_STORAGE_KEY)
    return null
  }
}

function persistCurrentUser(user: CurrentUser) {
  if (!canUseLocalStorage()) return
  window.localStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(user))
}

function clearCurrentUserCache() {
  if (!canUseLocalStorage()) return
  window.localStorage.removeItem(CURRENT_USER_STORAGE_KEY)
}

function readEmailCodes(): StoredEmailCodes {
  if (!canUseLocalStorage()) return {}

  const raw = window.localStorage.getItem(EMAIL_CODE_STORAGE_KEY)
  if (!raw) return {}

  try {
    return JSON.parse(raw) as StoredEmailCodes
  } catch {
    window.localStorage.removeItem(EMAIL_CODE_STORAGE_KEY)
    return {}
  }
}

function persistEmailCodes(codes: StoredEmailCodes) {
  if (!canUseLocalStorage()) return
  window.localStorage.setItem(EMAIL_CODE_STORAGE_KEY, JSON.stringify(codes))
}

function assertDevelopmentCode(code: string) {
  if (code !== DEVELOPMENT_EMAIL_CODE) {
    throw new Error('Неверный код подтверждения. Для demo-режима используйте 000000.')
  }
}

function ensureLocalCurrentUser() {
  const currentUser = readCurrentUser()
  if (!currentUser) {
    throw new Error('Пользователь не найден. Сначала выполните вход.')
  }
  return currentUser
}

function assertAppwriteAuthReady(methodName: string) {
  if (!hasAppwriteAuthConfig()) {
    const message = `[authService] ${methodName} requires VITE_APPWRITE_ENDPOINT and VITE_APPWRITE_PROJECT_ID.`
    console.error(message)
    throw new Error('Appwrite mode is enabled, but Appwrite Auth is not configured yet.')
  }
}

function isUnauthorizedError(error: unknown) {
  if (!(error instanceof Error)) return false

  const errorWithCode = error as Error & { code?: number | string; type?: string }
  return (
    errorWithCode.code === 401 ||
    errorWithCode.type === 'general_unauthorized_scope' ||
    errorWithCode.type === 'user_unauthorized' ||
    error.message.toLowerCase().includes('unauthorized')
  )
}

function warnProfilesUnavailable(reason?: string) {
  if (hasWarnedAboutProfiles) return
  hasWarnedAboutProfiles = true
  console.warn(
    `[authService] Profiles collection is unavailable. Auth will still work, but displayName/avatar mode data will fall back to local cache.${reason ? ` ${reason}` : ''}`,
  )
}

function warnEmailOtpMockOnly() {
  if (hasWarnedAboutEmailOtp) return
  hasWarnedAboutEmailOtp = true
  console.warn(
    '[authService] Email OTP in appwrite mode is still mock-only and does not use real SMTP/Appwrite OTP yet.',
  )
}

async function getCurrentAccount() {
  assertAppwriteAuthReady('getCurrentUser')

  try {
    return await appwriteAccount.get()
  } catch (error) {
    if (isUnauthorizedError(error)) {
      return null
    }
    throw error
  }
}

function canUseProfilesCollection() {
  return Boolean(APPWRITE_DATABASE_ID && APPWRITE_COLLECTIONS.profiles)
}

async function getProfileDocument(userId: string): Promise<ProfileDocument | null> {
  if (!canUseProfilesCollection()) {
    warnProfilesUnavailable('APPWRITE_DATABASE_ID or profiles collection id is missing.')
    return null
  }

  try {
    return await appwriteDatabases.getDocument<ProfileDocument>(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTIONS.profiles,
      userId,
    )
  } catch (error) {
    const errorWithCode = error as Error & { code?: number | string }
    if (errorWithCode?.code === 404) {
      warnProfilesUnavailable('Profile document not found yet.')
      return null
    }

    warnProfilesUnavailable(error instanceof Error ? error.message : undefined)
    return null
  }
}

function mapAppwriteAccountToCurrentUser(
  account: Models.User<Models.Preferences>,
  profile?: ProfileDocument | null,
  cachedUser?: CurrentUser | null,
): CurrentUser {
  const fallbackName = cachedUser?.displayName || account.name || createGuestFallbackName()
  const mode = profile?.mode ?? cachedUser?.mode ?? (account.email ? 'profile' : 'guest')
  const email = account.email || cachedUser?.email

  return {
    id: account.$id,
    mode,
    email: email || undefined,
    displayName: normalizeDisplayName(profile?.displayName ?? cachedUser?.displayName ?? account.name, fallbackName),
    avatarUrl: profile?.avatarUrl ?? cachedUser?.avatarUrl,
    avatarEmoji: cachedUser?.avatarEmoji,
    createdAt: profile?.createdAt ?? account.$createdAt,
    updatedAt: profile?.updatedAt ?? account.$updatedAt ?? account.$createdAt,
  }
}

async function upsertProfileDocument(input: {
  userId: string
  mode: 'guest' | 'profile'
  displayName?: string
  avatarUrl?: string
  createdAt?: string
  updatedAt?: string
}) {
  if (!canUseProfilesCollection()) {
    warnProfilesUnavailable('APPWRITE_DATABASE_ID or profiles collection id is missing.')
    return null
  }

  const payload = {
    userId: input.userId,
    mode: input.mode,
    displayName: input.displayName ?? '',
    avatarUrl: input.avatarUrl ?? '',
    createdAt: input.createdAt ?? new Date().toISOString(),
    updatedAt: input.updatedAt ?? new Date().toISOString(),
  }

  try {
    await appwriteDatabases.getDocument<ProfileDocument>(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTIONS.profiles,
      input.userId,
    )

    return await appwriteDatabases.updateDocument<ProfileDocument>(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTIONS.profiles,
      input.userId,
      payload,
    )
  } catch (error) {
    const errorWithCode = error as Error & { code?: number | string }

    if (errorWithCode?.code === 404) {
      try {
        return await appwriteDatabases.createDocument<ProfileDocument>(
          APPWRITE_DATABASE_ID,
          APPWRITE_COLLECTIONS.profiles,
          input.userId,
          payload,
        )
      } catch (createError) {
        warnProfilesUnavailable(createError instanceof Error ? createError.message : undefined)
        return null
      }
    }

    warnProfilesUnavailable(error instanceof Error ? error.message : undefined)
    return null
  }
}

async function getAppwriteCurrentUser() {
  const account = await getCurrentAccount()
  if (!account) {
    clearCurrentUserCache()
    return null
  }

  const cachedUser = readCurrentUser()
  const matchingCachedUser = cachedUser?.id === account.$id ? cachedUser : null
  const profile = await getProfileDocument(account.$id)
  const currentUser = mapAppwriteAccountToCurrentUser(account, profile, matchingCachedUser)
  persistCurrentUser(currentUser)
  return currentUser
}

function requestEmailCodeLocal(email: string) {
  const normalizedEmail = email.trim().toLowerCase()
  if (!normalizedEmail) {
    throw new Error('Email обязателен для входа в профиль.')
  }

  const codes = readEmailCodes()
  codes[normalizedEmail] = {
    code: DEVELOPMENT_EMAIL_CODE,
    requestedAt: new Date().toISOString(),
  }
  persistEmailCodes(codes)
}

function verifyEmailCodeLocal(email: string, code: string): CurrentUser {
  const normalizedEmail = email.trim().toLowerCase()
  if (!normalizedEmail) {
    throw new Error('Email обязателен для входа в профиль.')
  }

  assertDevelopmentCode(code.trim())

  const currentUser = readCurrentUser()
  const now = new Date().toISOString()

  if (currentUser && currentUser.mode !== 'profile') {
    return upgradeGuestToProfileLocal(normalizedEmail, code)
  }

  const profileUser: CurrentUser = currentUser
    ? {
        ...currentUser,
        mode: 'profile',
        email: normalizedEmail,
        displayName: currentUser.displayName || normalizedEmail.split('@')[0],
        updatedAt: now,
      }
    : {
        id: createId('user'),
        mode: 'profile',
        email: normalizedEmail,
        displayName: normalizedEmail.split('@')[0],
        createdAt: now,
        updatedAt: now,
      }

  persistCurrentUser(profileUser)
  return profileUser
}

function upgradeGuestToProfileLocal(email: string, code: string): CurrentUser {
  const currentUser = readCurrentUser()
  const normalizedEmail = email.trim().toLowerCase()
  if (!currentUser || (currentUser.mode !== 'guest' && currentUser.mode !== 'demo')) {
    return verifyEmailCodeLocal(normalizedEmail, code)
  }

  assertDevelopmentCode(code.trim())

  const profileUser: CurrentUser = {
    ...currentUser,
    mode: 'profile',
    email: normalizedEmail,
    displayName: currentUser.displayName || normalizedEmail.split('@')[0],
    updatedAt: new Date().toISOString(),
  }

  persistCurrentUser(profileUser)
  return profileUser
}

async function verifyEmailCodeAppwrite(email: string, code: string): Promise<CurrentUser> {
  requestEmailCodeLocal(email)
  assertDevelopmentCode(code.trim())
  warnEmailOtpMockOnly()

  const account = await getCurrentAccount()
  if (!account) {
    throw new Error('Для mock email-кода в appwrite mode сначала войдите как гость.')
  }

  const cachedUser = readCurrentUser()
  const nextUser = mapAppwriteAccountToCurrentUser(account, null, {
    id: account.$id,
    mode: 'profile',
    email: email.trim().toLowerCase(),
    displayName:
      cachedUser?.id === account.$id
        ? cachedUser.displayName
        : account.name || email.trim().toLowerCase().split('@')[0],
    avatarUrl: cachedUser?.id === account.$id ? cachedUser.avatarUrl : undefined,
    createdAt: cachedUser?.id === account.$id ? cachedUser.createdAt : account.$createdAt,
    updatedAt: new Date().toISOString(),
  })

  const profile = await upsertProfileDocument({
    userId: account.$id,
    mode: 'profile',
    displayName: nextUser.displayName,
    avatarUrl: nextUser.avatarUrl,
    createdAt: nextUser.createdAt,
    updatedAt: new Date().toISOString(),
  })

  const currentUser = {
    ...mapAppwriteAccountToCurrentUser(account, profile, nextUser),
    email: email.trim().toLowerCase(),
    mode: 'profile' as const,
  }

  persistCurrentUser(currentUser)
  return currentUser
}

async function updateCurrentUserProfileAppwrite(payload: {
  displayName?: string
  avatarUrl?: string
}): Promise<CurrentUser> {
  const account = await getCurrentAccount()
  if (!account) {
    throw new Error('Сначала выполните вход.')
  }

  const existingUser = (await getAppwriteCurrentUser()) ?? mapAppwriteAccountToCurrentUser(account)
  const nextDisplayName =
    payload.displayName !== undefined
      ? normalizeDisplayName(
          payload.displayName,
          existingUser.mode === 'profile' ? existingUser.displayName || account.name : createGuestFallbackName(),
        )
      : existingUser.displayName

  if (!nextDisplayName?.trim()) {
    throw new Error('Имя не может быть пустым.')
  }

  if (payload.displayName !== undefined && account.name !== nextDisplayName.trim()) {
    await appwriteAccount.updateName(nextDisplayName.trim())
  }

  const provisionalUser: CurrentUser = {
    ...existingUser,
    displayName: nextDisplayName.trim(),
    avatarUrl: payload.avatarUrl !== undefined ? payload.avatarUrl : existingUser.avatarUrl,
    updatedAt: new Date().toISOString(),
  }

  const profile = await upsertProfileDocument({
    userId: account.$id,
    mode: provisionalUser.mode === 'demo' ? 'guest' : provisionalUser.mode,
    displayName: provisionalUser.displayName,
    avatarUrl: provisionalUser.avatarUrl,
    createdAt: provisionalUser.createdAt,
    updatedAt: provisionalUser.updatedAt,
  })

  const nextUser = {
    ...mapAppwriteAccountToCurrentUser(account, profile, provisionalUser),
    email: provisionalUser.email,
  }

  persistCurrentUser(nextUser)
  return nextUser
}

export const authService = {
  async getCurrentUser(): Promise<CurrentUser | null> {
    return isAppwriteMode() ? getAppwriteCurrentUser() : readCurrentUser()
  },

  async createDemoUser(displayName = 'Юрий'): Promise<CurrentUser> {
    const now = new Date().toISOString()
    const demoUser: CurrentUser = {
      id: createId('demo'),
      mode: 'demo',
      displayName: normalizeDisplayName(displayName, 'Юрий'),
      createdAt: now,
      updatedAt: now,
    }

    persistCurrentUser(demoUser)
    return demoUser
  },

  async createGuestUser(displayName?: string): Promise<CurrentUser> {
    if (!isAppwriteMode()) {
      const currentUser = readCurrentUser()
      const now = new Date().toISOString()
      const normalizedName = normalizeDisplayName(displayName)

      if (currentUser?.mode === 'guest') {
        const nextGuest: CurrentUser = {
          ...currentUser,
          displayName: normalizedName,
          updatedAt: now,
        }
        persistCurrentUser(nextGuest)
        return nextGuest
      }

      const guestUser: CurrentUser = {
        id: createId('guest'),
        mode: 'guest',
        displayName: normalizedName,
        avatarUrl: currentUser?.mode === 'demo' ? currentUser.avatarUrl : undefined,
        createdAt: now,
        updatedAt: now,
      }

      persistCurrentUser(guestUser)
      return guestUser
    }

    assertAppwriteAuthReady('createGuestUser')
    const normalizedName = normalizeDisplayName(displayName)

    let account = await getCurrentAccount()
    if (!account) {
      await appwriteAccount.createAnonymousSession()
      account = await appwriteAccount.get()
    }

    if (account.name !== normalizedName) {
      await appwriteAccount.updateName(normalizedName)
      account = await appwriteAccount.get()
    }

    const cachedUser = readCurrentUser()
    const profile = await upsertProfileDocument({
      userId: account.$id,
      mode: 'guest',
      displayName: normalizedName,
      avatarUrl: cachedUser?.avatarUrl,
      createdAt: cachedUser?.createdAt ?? account.$createdAt,
      updatedAt: new Date().toISOString(),
    })

    const guestUser = mapAppwriteAccountToCurrentUser(account, profile, {
      id: account.$id,
      mode: 'guest',
      displayName: normalizedName,
      avatarUrl: cachedUser?.avatarUrl,
      createdAt: cachedUser?.createdAt ?? account.$createdAt,
      updatedAt: new Date().toISOString(),
    })

    persistCurrentUser(guestUser)
    return guestUser
  },

  async requestEmailCode(email: string): Promise<void> {
    if (isAppwriteMode()) {
      warnEmailOtpMockOnly()
    }

    requestEmailCodeLocal(email)
  },

  async verifyEmailCode(email: string, code: string): Promise<CurrentUser> {
    if (isAppwriteMode()) {
      return await verifyEmailCodeAppwrite(email, code)
    }

    return verifyEmailCodeLocal(email, code)
  },

  async upgradeGuestToProfile(email: string, code: string): Promise<CurrentUser> {
    if (isAppwriteMode()) {
      return await verifyEmailCodeAppwrite(email, code)
    }

    return upgradeGuestToProfileLocal(email, code)
  },

  async updateCurrentUserProfile(payload: {
    displayName?: string
    avatarUrl?: string
  }): Promise<CurrentUser> {
    if (isAppwriteMode()) {
      return await updateCurrentUserProfileAppwrite(payload)
    }

    const currentUser = ensureLocalCurrentUser()
    const nextDisplayName =
      payload.displayName !== undefined
        ? normalizeDisplayName(
            payload.displayName,
            currentUser.mode === 'profile' ? undefined : createGuestFallbackName(),
          )
        : currentUser.displayName

    if (!nextDisplayName?.trim()) {
      throw new Error('Имя не может быть пустым.')
    }

    const nextUser: CurrentUser = {
      ...currentUser,
      displayName: nextDisplayName.trim(),
      avatarUrl: payload.avatarUrl !== undefined ? payload.avatarUrl : currentUser.avatarUrl,
      updatedAt: new Date().toISOString(),
    }

    persistCurrentUser(nextUser)
    return nextUser
  },

  async updateDisplayName(displayName: string): Promise<CurrentUser> {
    if (!displayName.trim()) {
      throw new Error('Введите имя пользователя.')
    }

    return this.updateCurrentUserProfile({ displayName })
  },

  async updateAvatar(avatarUrl: string): Promise<CurrentUser> {
    if (!avatarUrl.trim()) {
      throw new Error('Не удалось сохранить аватар.')
    }

    return this.updateCurrentUserProfile({ avatarUrl })
  },

  async logout(): Promise<void> {
    if (!isAppwriteMode()) {
      if (!canUseLocalStorage()) return
      window.localStorage.removeItem(CURRENT_USER_STORAGE_KEY)
      return
    }

    assertAppwriteAuthReady('logout')

    try {
      await appwriteAccount.deleteSession('current')
    } catch (error) {
      if (!isUnauthorizedError(error)) {
        throw error
      }
    } finally {
      clearCurrentUserCache()
    }
  },
}

