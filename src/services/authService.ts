import type { CurrentUser } from '../types/user'

const CURRENT_USER_STORAGE_KEY = 'event-gallery:current-user'
const EMAIL_CODE_STORAGE_KEY = 'event-gallery:email-codes'
const DEVELOPMENT_EMAIL_CODE = '000000'

type StoredEmailCodes = Record<string, { code: string; requestedAt: string }>

function canUseLocalStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function createId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
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

export const authService = {
  async getCurrentUser(): Promise<CurrentUser | null> {
    return readCurrentUser()
  },

  async createGuestUser(displayName?: string): Promise<CurrentUser> {
    const currentUser = readCurrentUser()
    const now = new Date().toISOString()
    const normalizedName = displayName?.trim() || currentUser?.displayName || 'Юрий'

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
      createdAt: now,
      updatedAt: now,
    }

    persistCurrentUser(guestUser)
    return guestUser
  },

  async requestEmailCode(email: string): Promise<void> {
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
  },

  async verifyEmailCode(email: string, code: string): Promise<CurrentUser> {
    const normalizedEmail = email.trim().toLowerCase()
    if (!normalizedEmail) {
      throw new Error('Email обязателен для входа в профиль.')
    }

    assertDevelopmentCode(code.trim())

    const currentUser = readCurrentUser()
    const now = new Date().toISOString()

    if (currentUser?.mode === 'guest') {
      return this.upgradeGuestToProfile(normalizedEmail, code)
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
  },

  async upgradeGuestToProfile(email: string, code: string): Promise<CurrentUser> {
    const currentUser = readCurrentUser()
    const normalizedEmail = email.trim().toLowerCase()
    if (!currentUser || currentUser.mode !== 'guest') {
      return this.verifyEmailCode(normalizedEmail, code)
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
  },

  async logout(): Promise<void> {
    if (!canUseLocalStorage()) return
    window.localStorage.removeItem(CURRENT_USER_STORAGE_KEY)
  },
}
