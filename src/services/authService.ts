import { Permission, Role, type Models } from 'appwrite'
import { APPWRITE_COLLECTIONS, APPWRITE_DATABASE_ID } from '../config/appwriteSchema'
import { hasAppwriteAuthConfig, runtimeConfig } from '../config/runtime'
import { appwriteAccount, appwriteDatabases, appwriteId } from '../lib/appwrite'
import type { CurrentUser } from '../types/user'
import { resolveAvatarViewUrl } from '../utils/avatarUrl'
import { getMergedGuestIdsForProfile, rememberMergedGuestUserId } from '../utils/mergedGuestIds'
import { rememberProfileUserForEmail, resolveProfileUserIdForEmail } from '../utils/profileEmailRegistry'
import { isPersistableUrl, sanitizePersistableUrl } from '../utils/persistableUrl'
import { isAppwriteMode } from './adapters/dataMode'
import {
  clearGuestSessionLocalData,
  mergeGuestSessionBeforeProfileLogin,
  repairProfileOrganizerOwnership,
} from './guestMergeService'
import { savedPhotoService } from './savedPhotoService'

const CURRENT_USER_STORAGE_KEY = 'event-gallery:current-user'
const EMAIL_CODE_STORAGE_KEY = 'event-gallery:email-codes'
const PENDING_EMAIL_LOGIN_STORAGE_KEY = 'event-gallery:pending-email-login'
const EMAIL_CODE_COOLDOWN_MS = 60_000
const PENDING_EMAIL_CODE_TTL_MS = 15 * 60_000
const DEVELOPMENT_EMAIL_CODE = '000000'

type StoredEmailCodes = Record<string, { code: string; requestedAt: string }>

type PendingEmailLogin = {
  email: string
  userId: string
  guestUserIdForMerge?: string
  requestedAt: string
}

export type EmailCodeDelivery = 'appwrite' | 'local-dev'

type ProfileDocument = Models.Document & {
  userId: string
  mode: 'guest' | 'profile'
  displayName?: string
  avatarUrl?: string
  avatarFileId?: string
  email?: string
  createdAt: string
  updatedAt?: string
}

export { isPersistableUrl, sanitizePersistableUrl }

let hasWarnedAboutProfiles = false

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

function readPendingEmailLogin(): PendingEmailLogin | null {
  if (!canUseLocalStorage()) return null

  const raw = window.localStorage.getItem(PENDING_EMAIL_LOGIN_STORAGE_KEY)
  if (!raw) return null

  try {
    return JSON.parse(raw) as PendingEmailLogin
  } catch {
    window.localStorage.removeItem(PENDING_EMAIL_LOGIN_STORAGE_KEY)
    return null
  }
}

function persistPendingEmailLogin(payload: PendingEmailLogin) {
  if (!canUseLocalStorage()) return
  window.localStorage.setItem(PENDING_EMAIL_LOGIN_STORAGE_KEY, JSON.stringify(payload))
}

function clearPendingEmailLogin() {
  if (!canUseLocalStorage()) return
  window.localStorage.removeItem(PENDING_EMAIL_LOGIN_STORAGE_KEY)
}

function getAppwriteErrorCode(error: unknown) {
  if (!(error instanceof Error)) return undefined
  return (error as Error & { code?: number | string }).code
}

function formatAppwriteEmailTokenError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Не удалось запросить код.'
  const normalized = message.toLowerCase()
  const errorCode = getAppwriteErrorCode(error)
  const errorType = getAppwriteErrorType(error)

  if (
    errorType === 'user_session_already_exists' ||
    normalized.includes('session already exists') ||
    normalized.includes('unauthorized')
  ) {
    return 'Не удалось запросить код из‑за активной гостевой сессии. Обновите страницу и нажмите «Получить код» ещё раз.'
  }

  if (errorCode === 429 || normalized.includes('too many') || normalized.includes('rate limit')) {
    return `Слишком много запросов кода (лимит Appwrite). Подождите 1–2 минуты и попробуйте снова. Если используете Mailpit — проверьте http://localhost:8025: код мог уже уйти в предыдущем письме.`
  }

  if (normalized.includes('smtp') || normalized.includes('mail')) {
    return `${message} Настройте SMTP в .env сервера Appwrite (_APP_SMTP_*), не во фронтенде. См. docs/email-otp-setup.md`
  }

  return `${message} Проверьте Appwrite Console → Auth (включён Email OTP) и SMTP сервера. См. docs/email-otp-setup.md`
}

function canReusePendingEmailCode(email: string, guestUserIdForMerge?: string) {
  const pending = readPendingEmailLogin()
  if (!pending || pending.email !== email) {
    return false
  }

  if (guestUserIdForMerge && pending.guestUserIdForMerge !== guestUserIdForMerge) {
    return false
  }

  const ageMs = Date.now() - new Date(pending.requestedAt).getTime()
  return ageMs >= 0 && ageMs < PENDING_EMAIL_CODE_TTL_MS
}

function assertEmailCodeCooldown(email: string) {
  const pending = readPendingEmailLogin()
  if (!pending || pending.email !== email) {
    return
  }

  const ageMs = Date.now() - new Date(pending.requestedAt).getTime()
  if (ageMs < EMAIL_CODE_COOLDOWN_MS) {
    const waitSeconds = Math.ceil((EMAIL_CODE_COOLDOWN_MS - ageMs) / 1000)
    throw new Error(`Код уже запрошен. Подождите ${waitSeconds} сек. или проверьте Mailpit (http://localhost:8025).`)
  }
}

function isGuestLikeMode(mode?: CurrentUser['mode']) {
  return mode === 'guest' || mode === 'demo'
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

function getAppwriteErrorType(error: unknown) {
  if (!(error instanceof Error)) return undefined
  return (error as Error & { type?: string }).type
}

async function endCurrentAppwriteSession() {
  try {
    await appwriteAccount.deleteSession({ sessionId: 'current' })
  } catch (error) {
    if (!isUnauthorizedError(error) && getAppwriteErrorType(error) !== 'user_session_not_found') {
      throw error
    }
  }
}

async function restoreGuestAppwriteSession(cachedGuest: CurrentUser) {
  if (!isGuestLikeMode(cachedGuest.mode)) {
    return null
  }

  try {
    await endCurrentAppwriteSession()
  } catch (error) {
    if (!isUnauthorizedError(error) && getAppwriteErrorType(error) !== 'user_session_not_found') {
      console.warn('[authService] failed to clear session before guest restore', error)
    }
  }

  await appwriteAccount.createAnonymousSession()
  const account = await appwriteAccount.get()
  const profile = await ensureProfileDocumentForAccount(account, cachedGuest, {
    mode: 'guest',
    displayName: cachedGuest.displayName,
    avatarUrl: cachedGuest.avatarUrl,
    avatarFileId: cachedGuest.avatarFileId,
  })

  const restoredGuest = mapAppwriteAccountToCurrentUser(account, profile, {
    ...cachedGuest,
    id: account.$id,
    mode: 'guest',
    updatedAt: new Date().toISOString(),
  })

  persistCurrentUser(restoredGuest)
  return restoredGuest
}

function resolveGuestUserIdForMergeFromCache() {
  const currentUser = readCurrentUser()
  if (!currentUser || !isGuestLikeMode(currentUser.mode)) {
    return undefined
  }

  if (currentUser.id.startsWith('guest_') || currentUser.id.startsWith('user_')) {
    return undefined
  }

  return currentUser.id
}

async function createAppwriteEmailTokenStateless(email: string, userId?: string) {
  const projectId = runtimeConfig.appwriteProjectId
  const endpoint = runtimeConfig.appwriteEndpoint.replace(/\/$/, '')
  const resolvedUserId = userId ?? appwriteId.unique()

  const response = await fetch(`${endpoint}/account/tokens/email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Appwrite-Project': projectId,
    },
    body: JSON.stringify({ userId: resolvedUserId, email }),
    credentials: 'omit',
  })

  if (!response.ok) {
    let payload: { message?: string; code?: number; type?: string } = {}
    try {
      payload = await response.json()
    } catch {
      // ignore parse errors
    }

    const error = new Error(payload.message || 'Не удалось запросить код.') as Error & {
      code?: number
      type?: string
    }
    error.code = payload.code
    error.type = payload.type
    throw error
  }

  const token = (await response.json()) as { userId?: string }
  return { userId: token.userId ?? resolvedUserId }
}

async function deliverAppwriteEmailToken(email: string, userId: string) {
  await endCurrentAppwriteSession()
  const token = await appwriteAccount.createEmailToken({
    userId,
    email,
  })
  return { userId: token.userId }
}

function normalizeEmailOtpCode(code: string) {
  return code.trim().replace(/\s+/g, '')
}

function formatEmailSessionError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Не удалось подтвердить код.'
  const type = getAppwriteErrorType(error)

  if (type === 'user_session_already_exists') {
    return 'Уже есть активная сессия. Обновите страницу и попробуйте снова.'
  }

  if (type === 'user_invalid_token' || message.toLowerCase().includes('invalid')) {
    return 'Неверный или просроченный код. Запросите новый в Mailpit (http://localhost:8025) или на почте.'
  }

  return `Не удалось войти: ${message}`
}

function warnProfilesUnavailable(reason?: string) {
  if (hasWarnedAboutProfiles) return
  hasWarnedAboutProfiles = true
  console.warn(
    `[authService] Profiles collection is unavailable. Auth will still work, but displayName/avatar mode data will fall back to local cache.${reason ? ` ${reason}` : ''}`,
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
      return null
    }

    warnProfilesUnavailable(error instanceof Error ? error.message : undefined)
    return null
  }
}

async function ensureProfileDocumentForAccount(
  account: Models.User<Models.Preferences>,
  cachedUser?: CurrentUser | null,
  overrides?: {
    mode?: 'guest' | 'profile'
    displayName?: string
    avatarUrl?: string
    avatarFileId?: string
    email?: string
    preserveEstablishedProfile?: boolean
  },
) {
  const existingProfile = await getProfileDocument(account.$id)
  const fallbackName = cachedUser?.displayName || account.name || createGuestFallbackName()
  const nextMode =
    overrides?.mode ??
    existingProfile?.mode ??
    (cachedUser?.mode === 'profile' ? 'profile' : account.email || overrides?.email ? 'profile' : 'guest')
  const preserveEstablishedProfile =
    overrides?.preserveEstablishedProfile ?? (existingProfile?.mode === 'profile' && nextMode === 'profile')

  const nextDisplayName = preserveEstablishedProfile
    ? normalizeDisplayName(existingProfile?.displayName ?? account.name, fallbackName)
    : normalizeDisplayName(
        overrides?.displayName ?? existingProfile?.displayName ?? cachedUser?.displayName ?? account.name,
        fallbackName,
      )
  const nextAvatarUrl = preserveEstablishedProfile
    ? existingProfile?.avatarUrl
    : overrides?.avatarUrl ?? existingProfile?.avatarUrl ?? cachedUser?.avatarUrl
  const nextAvatarFileId = preserveEstablishedProfile
    ? existingProfile?.avatarFileId
    : overrides?.avatarFileId ?? existingProfile?.avatarFileId ?? cachedUser?.avatarFileId
  const nextCreatedAt = existingProfile?.createdAt ?? cachedUser?.createdAt ?? account.$createdAt
  const nextUpdatedAt = new Date().toISOString()

  if (
    existingProfile &&
    existingProfile.mode === nextMode &&
    (existingProfile.displayName ?? '') === nextDisplayName &&
    (existingProfile.avatarUrl ?? '') === (nextAvatarUrl ?? '') &&
    (existingProfile.avatarFileId ?? '') === (nextAvatarFileId ?? '')
  ) {
    return existingProfile
  }

  return await upsertProfileDocument({
    userId: account.$id,
    mode: nextMode,
    displayName: nextDisplayName,
    avatarUrl: nextAvatarUrl,
    avatarFileId: nextAvatarFileId,
    email: overrides?.email,
    createdAt: nextCreatedAt,
    updatedAt: nextUpdatedAt,
  })
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
    avatarFileId: profile?.avatarFileId ?? cachedUser?.avatarFileId,
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
  avatarFileId?: string
  email?: string
  createdAt?: string
  updatedAt?: string
}) {
  if (!canUseProfilesCollection()) {
    warnProfilesUnavailable('APPWRITE_DATABASE_ID or profiles collection id is missing.')
    return null
  }

  const safeAvatarUrl = resolveAvatarViewUrl(input.avatarUrl, input.avatarFileId) ?? ''
  if (input.avatarUrl?.startsWith('data:')) {
    console.error('[authService] Refusing to persist base64 avatarUrl in profiles collection.')
  }

  const payload = {
    userId: input.userId,
    mode: input.mode,
    displayName: input.displayName ?? '',
    avatarUrl: safeAvatarUrl,
    avatarFileId: input.avatarFileId ?? '',
    email: input.email?.trim().toLowerCase() ?? '',
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
          [
            Permission.read(Role.users()),
            Permission.update(Role.user(input.userId)),
            Permission.delete(Role.user(input.userId)),
          ],
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
  const cachedUser = readCurrentUser()
  let account = await getCurrentAccount()

  if (!account && cachedUser && isGuestLikeMode(cachedUser.mode)) {
    try {
      return await restoreGuestAppwriteSession(cachedUser)
    } catch (error) {
      console.warn('[authService] failed to restore guest session from cache', error)
      return cachedUser
    }
  }

  if (!account) {
    if (!cachedUser || !isGuestLikeMode(cachedUser.mode)) {
      clearCurrentUserCache()
    }
    return cachedUser && isGuestLikeMode(cachedUser.mode) ? cachedUser : null
  }

  const matchingCachedUser = cachedUser?.id === account.$id ? cachedUser : null
  const existingProfile = await getProfileDocument(account.$id)
  const resolvedMode =
    existingProfile?.mode === 'profile' || account.email || matchingCachedUser?.mode === 'profile'
      ? 'profile'
      : 'guest'

  const profile = await ensureProfileDocumentForAccount(account, matchingCachedUser, {
    mode: resolvedMode,
    displayName: existingProfile?.displayName ?? matchingCachedUser?.displayName,
    avatarUrl: existingProfile?.avatarUrl ?? matchingCachedUser?.avatarUrl,
    avatarFileId: existingProfile?.avatarFileId ?? matchingCachedUser?.avatarFileId,
    email: account.email || matchingCachedUser?.email,
    preserveEstablishedProfile: existingProfile?.mode === 'profile',
  })
  const currentUser = mapAppwriteAccountToCurrentUser(account, profile, matchingCachedUser)
  if (currentUser.mode === 'profile' && currentUser.email) {
    rememberProfileUserForEmail(currentUser.email, currentUser.id)
  }
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
  const guestUserIdForMerge =
    currentUser && isGuestLikeMode(currentUser.mode) ? currentUser.id : undefined

  if (currentUser && isGuestLikeMode(currentUser.mode)) {
    const profileUser: CurrentUser = {
      ...currentUser,
      mode: 'profile',
      email: normalizedEmail,
      displayName: currentUser.displayName || normalizedEmail.split('@')[0],
      updatedAt: now,
    }

    persistCurrentUser(profileUser)
    if (guestUserIdForMerge) {
      clearGuestSessionLocalData(guestUserIdForMerge, 'upgrade')
    }
    clearPendingEmailLogin()
    return profileUser
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
  clearPendingEmailLogin()
  return profileUser
}

function upgradeGuestToProfileLocal(email: string, code: string): CurrentUser {
  return verifyEmailCodeLocal(email, code)
}

async function requestEmailCodeAppwrite(email: string): Promise<EmailCodeDelivery> {
  assertAppwriteAuthReady('requestEmailCode')
  const normalizedEmail = email.trim().toLowerCase()
  if (!normalizedEmail) {
    throw new Error('Email обязателен для входа в профиль.')
  }

  const guestUserIdForMerge = resolveGuestUserIdForMergeFromCache()
  const guestCachedUser = readCurrentUser()

  if (canReusePendingEmailCode(normalizedEmail, guestUserIdForMerge)) {
    assertEmailCodeCooldown(normalizedEmail)
    return 'appwrite'
  }

  clearPendingEmailLogin()

  const knownProfileUserId = resolveProfileUserIdForEmail(normalizedEmail)

  try {
    let profileUserId = knownProfileUserId ?? appwriteId.unique()
    const guestAccount = guestUserIdForMerge ? await getCurrentAccount() : null
    const guestSessionActive = Boolean(guestUserIdForMerge && guestAccount?.$id === guestUserIdForMerge)

    if (guestSessionActive && guestUserIdForMerge) {
      rememberMergedGuestUserId(guestUserIdForMerge, knownProfileUserId)

      try {
        const stateless = await createAppwriteEmailTokenStateless(
          normalizedEmail,
          knownProfileUserId ?? profileUserId,
        )
        profileUserId = stateless.userId
      } catch (error) {
        if (knownProfileUserId) {
          throw error
        }
        console.warn('[authService] stateless email token reservation failed, using generated userId', error)
      }
    } else {
      const token = await deliverAppwriteEmailToken(normalizedEmail, knownProfileUserId ?? profileUserId)
      profileUserId = token.userId
    }

    persistPendingEmailLogin({
      email: normalizedEmail,
      userId: profileUserId,
      guestUserIdForMerge,
      requestedAt: new Date().toISOString(),
    })
    return 'appwrite'
  } catch (error) {
    if (getAppwriteErrorCode(error) === 429 && canReusePendingEmailCode(normalizedEmail, guestUserIdForMerge)) {
      return 'appwrite'
    }

    throw new Error(formatAppwriteEmailTokenError(error))
  }
}

async function reconcileHistoricalGuestAssets(profileUserId: string, currentGuestUserId?: string) {
  const guestIds = new Set(getMergedGuestIdsForProfile(profileUserId))
  if (currentGuestUserId) {
    guestIds.add(currentGuestUserId)
  }

  const { achievementService } = await import('./achievementService')

  for (const guestUserId of guestIds) {
    if (!guestUserId || guestUserId === profileUserId) continue
    savedPhotoService.migrateSavedPhotosUserId(guestUserId, profileUserId)
    achievementService.migrateAchievementTemplatesUserId(guestUserId, profileUserId)
  }

  try {
    await repairProfileOrganizerOwnership(profileUserId)
  } catch (error) {
    console.warn('[authService] repair organizer ownership after profile login failed', error)
  }
}

async function verifyEmailCodeAppwrite(email: string, code: string): Promise<CurrentUser> {
  const normalizedEmail = email.trim().toLowerCase()
  const trimmedCode = normalizeEmailOtpCode(code)
  if (!normalizedEmail) {
    throw new Error('Email обязателен для входа в профиль.')
  }
  if (!trimmedCode) {
    throw new Error('Введите код подтверждения.')
  }

  const pending = readPendingEmailLogin()
  if (!pending || pending.email !== normalizedEmail) {
    throw new Error('Сначала запросите код для этого email.')
  }

  const guestUserIdForMerge = pending.guestUserIdForMerge
  const guestCachedUser = readCurrentUser()

  const guestCachedForMerge =
    guestCachedUser?.id === guestUserIdForMerge ? guestCachedUser : null
  const profileDisplayNameForMerge = normalizeDisplayName(
    guestCachedForMerge?.displayName,
    normalizedEmail.split('@')[0],
  )
  const profileAvatarUrlForMerge = guestCachedForMerge?.avatarUrl
  const profileAvatarFileIdForMerge = guestCachedForMerge?.avatarFileId

  if (guestUserIdForMerge && guestCachedForMerge) {
    try {
      const activeGuestAccount = await getCurrentAccount()
      if (activeGuestAccount?.$id === guestUserIdForMerge) {
        await mergeGuestSessionBeforeProfileLogin({
          guestUserId: guestUserIdForMerge,
          profileUserId: pending.userId,
          profileDisplayName: profileDisplayNameForMerge,
          profileAvatarUrl: profileAvatarUrlForMerge,
          profileAvatarFileId: profileAvatarFileIdForMerge,
        })
        savedPhotoService.migrateSavedPhotosUserId(guestUserIdForMerge, pending.userId)
      }
    } catch (error) {
      console.warn('[authService] guest merge before profile login failed', error)
    }
  }

  // Appwrite не создаёт session/token, пока активна гостевая (anonymous) сессия.
  await endCurrentAppwriteSession()

  try {
    try {
      await appwriteAccount.createSession({
        userId: pending.userId,
        secret: trimmedCode,
      })
    } catch (error) {
      if (getAppwriteErrorType(error) === 'user_session_already_exists') {
        await endCurrentAppwriteSession()
        await appwriteAccount.createSession({
          userId: pending.userId,
          secret: trimmedCode,
        })
      } else {
        throw error
      }
    }
  } catch (error) {
    if (guestCachedForMerge) {
      await restoreGuestAppwriteSession(guestCachedForMerge)
    }
    throw new Error(formatEmailSessionError(error))
  }

  const account = await appwriteAccount.get()
  const profileUserId = account.$id
  const existingProfile = await getProfileDocument(profileUserId)
  const isGuestUpgrade = Boolean(guestUserIdForMerge && guestCachedForMerge)
  const guestName = guestCachedForMerge?.displayName?.trim()
  const guestHasAvatar = Boolean(guestCachedForMerge?.avatarUrl || guestCachedForMerge?.avatarFileId)

  const profileDisplayName = normalizeDisplayName(
    isGuestUpgrade && guestName
      ? guestName
      : existingProfile?.displayName ?? account.name ?? normalizedEmail.split('@')[0],
    normalizedEmail.split('@')[0],
  )
  const profileAvatarUrl =
    isGuestUpgrade && guestHasAvatar ? guestCachedForMerge?.avatarUrl : existingProfile?.avatarUrl
  const profileAvatarFileId =
    isGuestUpgrade && guestHasAvatar ? guestCachedForMerge?.avatarFileId : existingProfile?.avatarFileId

  if (account.name !== profileDisplayName) {
    await appwriteAccount.updateName(profileDisplayName)
    await appwriteAccount.get()
  }

  const profile = await ensureProfileDocumentForAccount(account, guestCachedForMerge, {
    mode: 'profile',
    displayName: profileDisplayName,
    avatarUrl: profileAvatarUrl,
    avatarFileId: profileAvatarFileId,
    email: normalizedEmail,
    preserveEstablishedProfile: !isGuestUpgrade,
  })

  clearPendingEmailLogin()
  if (guestUserIdForMerge) {
    rememberMergedGuestUserId(guestUserIdForMerge, profileUserId)
    clearGuestSessionLocalData(guestUserIdForMerge, 'upgrade')
  }

  rememberProfileUserForEmail(normalizedEmail, profileUserId)

  const currentUser = {
    ...mapAppwriteAccountToCurrentUser(account, profile, guestCachedForMerge),
    email: normalizedEmail,
    mode: 'profile' as const,
    displayName: profileDisplayName,
    avatarUrl: profileAvatarUrl,
    avatarFileId: profileAvatarFileId,
  }

  persistCurrentUser(currentUser)

  await reconcileHistoricalGuestAssets(profileUserId, guestUserIdForMerge)

  return currentUser
}

async function updateCurrentUserProfileAppwrite(payload: {
  displayName?: string
  avatarUrl?: string
  avatarFileId?: string
}): Promise<CurrentUser> {
  const account = await getCurrentAccount()
  if (!account) {
    throw new Error('Сначала выполните вход.')
  }

  if (payload.avatarUrl?.startsWith('data:') || payload.avatarUrl?.startsWith('blob:')) {
    throw new Error('Аватар нужно загрузить через Storage, а не как локальный preview.')
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

  const nextAvatarFileId =
    payload.avatarFileId !== undefined ? payload.avatarFileId : existingUser.avatarFileId
  const nextAvatarUrl =
    payload.avatarUrl !== undefined || payload.avatarFileId !== undefined
      ? resolveAvatarViewUrl(payload.avatarUrl ?? existingUser.avatarUrl, nextAvatarFileId)
      : resolveAvatarViewUrl(existingUser.avatarUrl, existingUser.avatarFileId)

  const provisionalUser: CurrentUser = {
    ...existingUser,
    displayName: nextDisplayName.trim(),
    avatarUrl: nextAvatarUrl || undefined,
    avatarFileId: nextAvatarFileId || undefined,
    updatedAt: new Date().toISOString(),
  }

  const profile = await upsertProfileDocument({
    userId: account.$id,
    mode: provisionalUser.mode === 'demo' ? 'guest' : provisionalUser.mode,
    displayName: provisionalUser.displayName,
    avatarUrl: provisionalUser.avatarUrl,
    avatarFileId: provisionalUser.avatarFileId,
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
    const matchingCachedUser = cachedUser?.id === account.$id ? cachedUser : null
    const profile = await ensureProfileDocumentForAccount(account, matchingCachedUser, {
      mode: matchingCachedUser?.mode === 'profile' ? 'profile' : 'guest',
      displayName: normalizedName,
      avatarUrl: matchingCachedUser?.avatarUrl,
    })

    const guestUser = mapAppwriteAccountToCurrentUser(account, profile, {
      id: account.$id,
      mode: matchingCachedUser?.mode === 'profile' ? 'profile' : 'guest',
      displayName: normalizedName,
      avatarUrl: matchingCachedUser?.avatarUrl,
      createdAt: matchingCachedUser?.createdAt ?? account.$createdAt,
      updatedAt: new Date().toISOString(),
    })

    persistCurrentUser(guestUser)
    return guestUser
  },

  async requestEmailCode(email: string): Promise<EmailCodeDelivery> {
    if (isAppwriteMode()) {
      return await requestEmailCodeAppwrite(email)
    }

    const normalizedEmail = email.trim().toLowerCase()
    if (!normalizedEmail) {
      throw new Error('Email обязателен для входа в профиль.')
    }

    requestEmailCodeLocal(normalizedEmail)
    const currentUser = readCurrentUser()
    persistPendingEmailLogin({
      email: normalizedEmail,
      userId: currentUser?.id ?? createId('user'),
      guestUserIdForMerge:
        currentUser && isGuestLikeMode(currentUser.mode) ? currentUser.id : undefined,
      requestedAt: new Date().toISOString(),
    })
    return 'local-dev'
  },

  async verifyEmailCode(email: string, code: string): Promise<CurrentUser> {
    if (isAppwriteMode()) {
      return await verifyEmailCodeAppwrite(email, code)
    }

    return verifyEmailCodeLocal(email, code)
  },

  async upgradeGuestToProfile(email: string, code: string): Promise<CurrentUser> {
    return await this.verifyEmailCode(email, code)
  },

  async updateCurrentUserProfile(payload: {
    displayName?: string
    avatarUrl?: string
    avatarFileId?: string
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
      avatarFileId: payload.avatarFileId !== undefined ? payload.avatarFileId : currentUser.avatarFileId,
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

    if (isAppwriteMode() && !isPersistableUrl(avatarUrl)) {
      throw new Error('Аватар нужно загрузить через Storage.')
    }

    return this.updateCurrentUserProfile({ avatarUrl })
  },

  async logout(): Promise<void> {
    const currentUser = readCurrentUser()
    const guestUserId =
      currentUser && isGuestLikeMode(currentUser.mode) ? currentUser.id : undefined

    if (currentUser?.mode === 'profile' && currentUser.email) {
      rememberProfileUserForEmail(currentUser.email, currentUser.id)
    }

    if (!isAppwriteMode()) {
      if (guestUserId) {
        clearGuestSessionLocalData(guestUserId)
      }
      clearPendingEmailLogin()
      clearCurrentUserCache()
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
      if (guestUserId) {
        clearGuestSessionLocalData(guestUserId)
      }
      clearPendingEmailLogin()
      clearCurrentUserCache()
    }
  },
}
