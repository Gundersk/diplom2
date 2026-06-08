/**
 * Участники события: роль (organizer/guest), очки, аватар для ленты и чата.
 * Local: массив в localStorage; Appwrite: коллекция participants с documentSecurity.
 * syncUserProfileToParticipations — прокидывает смену имени/аватара во все события пользователя.
 */
import { Permission, Role, type Models } from 'appwrite'
import { APPWRITE_COLLECTIONS, APPWRITE_DATABASE_ID } from '../config/appwriteSchema'
import { hasAppwriteRuntimeConfig } from '../config/runtime'
import { appwriteDatabases, appwriteId, appwriteQuery } from '../lib/appwrite'
import type { EventParticipant } from '../types/participant'
import type { CurrentUser } from '../types/user'
import { dedupeEventParticipants } from '../utils/dedupeParticipants'
import { buildUserOwnedDocumentPermissions } from '../utils/appwriteDocumentPermissions'
import { resolveAvatarViewUrl } from '../utils/avatarUrl'
import { sanitizePersistableUrl } from '../utils/persistableUrl'
import { isAppwriteMode } from './adapters/dataMode'
import { authService } from './authService'

// --- LocalStorage ---
const PARTICIPANTS_STORAGE_KEY = 'event-gallery:participants'

type ParticipantDocument = Models.Document & {
  eventId: string
  userId: string
  displayName: string
  role: 'organizer' | 'guest'
  points: number
  joinedAt: string
  updatedAt?: string
  avatarUrl?: string
  avatarFileId?: string
}

function canUseLocalStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function createId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

function readParticipants(): EventParticipant[] {
  if (!canUseLocalStorage()) return []

  const raw = window.localStorage.getItem(PARTICIPANTS_STORAGE_KEY)
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as EventParticipant[]) : []
  } catch {
    window.localStorage.removeItem(PARTICIPANTS_STORAGE_KEY)
    return []
  }
}

function persistParticipants(participants: EventParticipant[]) {
  if (!canUseLocalStorage()) return
  window.localStorage.setItem(PARTICIPANTS_STORAGE_KEY, JSON.stringify(participants))
}

function assertAppwriteReady(methodName: string) {
  if (!hasAppwriteRuntimeConfig() || !APPWRITE_DATABASE_ID) {
    const message =
      `[participantService] ${methodName} requires Appwrite runtime config and an existing participants collection.`
    console.error(message)
    throw new Error('Appwrite mode is enabled, but the participants adapter is not configured yet.')
  }
}

function buildParticipantAvatarFields(user: Pick<CurrentUser, 'avatarUrl' | 'avatarFileId'>) {
  const avatarFileId = user.avatarFileId ?? ''

  if (isAppwriteMode()) {
    return {
      avatarUrl: resolveAvatarViewUrl(user.avatarUrl, avatarFileId) ?? '',
      avatarFileId,
    }
  }

  return {
    avatarUrl: user.avatarUrl ?? '',
    avatarFileId,
  }
}

function participantAvatarFieldsChanged(
  existing: Pick<ParticipantDocument, 'avatarUrl' | 'avatarFileId'>,
  avatarUrl: string,
  avatarFileId: string,
) {
  return (existing.avatarUrl ?? '') !== avatarUrl || (existing.avatarFileId ?? '') !== avatarFileId
}

function normalizeParticipant(document: ParticipantDocument): EventParticipant {
  return {
    id: document.$id,
    eventId: document.eventId,
    userId: document.userId,
    displayName: document.displayName || 'Гость',
    role: document.role === 'organizer' ? 'organizer' : 'guest',
    points: Number(document.points ?? 0) || 0,
    joinedAt: document.joinedAt ?? document.$createdAt,
    updatedAt: document.updatedAt ?? document.$updatedAt ?? document.$createdAt,
    avatarUrl: document.avatarUrl || undefined,
    avatarFileId: document.avatarFileId || undefined,
  }
}

// --- Appwrite: поиск и нормализация документов ---
async function findParticipantDocument(eventId: string, userId: string) {
  const response = await appwriteDatabases.listDocuments<ParticipantDocument>(
    APPWRITE_DATABASE_ID,
    APPWRITE_COLLECTIONS.participants,
    [
      appwriteQuery.equal('eventId', eventId),
      appwriteQuery.equal('userId', userId),
      appwriteQuery.limit(1),
    ],
  )

  return response.documents[0] ?? null
}

async function findParticipantDocumentById(participantId: string) {
  return appwriteDatabases.getDocument<ParticipantDocument>(
    APPWRITE_DATABASE_ID,
    APPWRITE_COLLECTIONS.participants,
    participantId,
  )
}

export const participantService = {
  async getParticipant(eventId: string, userId: string): Promise<EventParticipant | null> {
    if (!isAppwriteMode()) {
      return readParticipants().find((item) => item.eventId === eventId && item.userId === userId) ?? null
    }

    assertAppwriteReady('getParticipant')
    const document = await findParticipantDocument(eventId, userId)
    return document ? normalizeParticipant(document) : null
  },

  async getEventParticipants(eventId: string): Promise<EventParticipant[]> {
    if (!isAppwriteMode()) {
      return readParticipants().filter((item) => item.eventId === eventId)
    }

    assertAppwriteReady('getEventParticipants')
    const response = await appwriteDatabases.listDocuments<ParticipantDocument>(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTIONS.participants,
      [
        appwriteQuery.equal('eventId', eventId),
        appwriteQuery.limit(5000),
      ],
    )

    const participants = response.documents.map((document) => normalizeParticipant(document))
    const currentUser = await authService.getCurrentUser()
    if (!currentUser?.id) {
      return participants
    }

    return dedupeEventParticipants(participants, currentUser.id)
  },

  async getUserParticipations(userId: string): Promise<EventParticipant[]> {
    if (!isAppwriteMode()) {
      return readParticipants().filter((item) => item.userId === userId)
    }

    assertAppwriteReady('getUserParticipations')
    const response = await appwriteDatabases.listDocuments<ParticipantDocument>(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTIONS.participants,
      [
        appwriteQuery.equal('userId', userId),
        appwriteQuery.limit(5000),
      ],
    )

    return response.documents.map((document) => normalizeParticipant(document))
  },

  async syncUserProfileToParticipations(
    userId: string,
    profile: Pick<CurrentUser, 'displayName' | 'avatarUrl' | 'avatarFileId'>,
  ): Promise<EventParticipant[]> {
    const normalizedName = profile.displayName?.trim() || 'Гость'
    const { avatarUrl, avatarFileId } = buildParticipantAvatarFields(profile)
    const participations = await this.getUserParticipations(userId)

    if (participations.length === 0) {
      return []
    }

    if (!isAppwriteMode()) {
      const now = new Date().toISOString()
      const updatedParticipations = participations.map((participant) => {
        const needsUpdate =
          participant.displayName !== normalizedName ||
          participantAvatarFieldsChanged(participant, avatarUrl, avatarFileId)

        if (!needsUpdate) {
          return participant
        }

        return {
          ...participant,
          displayName: normalizedName,
          avatarUrl: avatarUrl || participant.avatarUrl,
          avatarFileId: avatarFileId || participant.avatarFileId,
          updatedAt: now,
        }
      })

      persistParticipants(
        readParticipants().map((participant) => {
          const updated = updatedParticipations.find((item) => item.id === participant.id)
          return updated ?? participant
        }),
      )

      return updatedParticipations
    }

    const results = await Promise.allSettled(
      participations.map(async (participant) => {
        const needsUpdate =
          participant.displayName !== normalizedName ||
          participantAvatarFieldsChanged(participant, avatarUrl, avatarFileId)

        if (!needsUpdate) {
          return participant
        }

        return this.updateParticipantProfile(participant.id, {
          displayName: normalizedName,
          avatarUrl,
          avatarFileId,
        })
      }),
    )

    const updatedParticipations: EventParticipant[] = []
    for (const result of results) {
      if (result.status === 'fulfilled') {
        updatedParticipations.push(result.value)
        continue
      }

      console.warn('[participantService] failed to sync participant avatar', result.reason)
    }

    return updatedParticipations
  },

  async getOrganizerParticipant(eventId: string, organizerId?: string): Promise<EventParticipant | null> {
    if (!organizerId) {
      return null
    }

    const directMatch = await this.getParticipant(eventId, organizerId)
    if (directMatch) {
      return directMatch
    }

    const participants = await this.getEventParticipants(eventId)
    return participants.find((participant) => participant.role === 'organizer') ?? null
  },

  async joinEventAsParticipant(
    eventId: string,
    displayName: string,
    role: 'organizer' | 'guest' = 'guest',
  ): Promise<EventParticipant> {
    const currentUser = await authService.getCurrentUser()
    if (!currentUser) {
      throw new Error('Пользователь не авторизован.')
    }

    const normalizedName = displayName.trim() || currentUser.displayName || 'Гость'
    const { avatarUrl, avatarFileId } = buildParticipantAvatarFields(currentUser)
    const now = new Date().toISOString()

    if (!isAppwriteMode()) {
      const participants = readParticipants()
      const existing = participants.find((item) => item.eventId === eventId && item.userId === currentUser.id)

      if (existing) {
        const nextRole = existing.role === 'organizer' && role === 'guest' ? 'organizer' : role
        const updatedParticipant: EventParticipant = {
          ...existing,
          displayName: normalizedName,
          role: nextRole,
          avatarUrl: avatarUrl || existing.avatarUrl,
          avatarFileId: avatarFileId || existing.avatarFileId,
          updatedAt: now,
        }

        persistParticipants(
          participants.map((item) => (item.id === updatedParticipant.id ? updatedParticipant : item)),
        )
        return updatedParticipant
      }

      const participant: EventParticipant = {
        id: createId('participant'),
        eventId,
        userId: currentUser.id,
        displayName: normalizedName,
        role,
        points: 0,
        joinedAt: now,
        updatedAt: now,
        avatarUrl: avatarUrl || undefined,
        avatarFileId: avatarFileId || undefined,
      }

      persistParticipants([...participants, participant])
      return participant
    }

    assertAppwriteReady('joinEventAsParticipant')
    const existing = await findParticipantDocument(eventId, currentUser.id)

    if (existing) {
      const nextRole = existing.role === 'organizer' && role === 'guest' ? 'organizer' : role
      const needsUpdate =
        existing.displayName !== normalizedName ||
        existing.role !== nextRole ||
        participantAvatarFieldsChanged(existing, avatarUrl, avatarFileId)

      if (needsUpdate) {
        const updated = await appwriteDatabases.updateDocument<ParticipantDocument>(
          APPWRITE_DATABASE_ID,
          APPWRITE_COLLECTIONS.participants,
          existing.$id,
          {
            displayName: normalizedName,
            role: nextRole,
            avatarUrl,
            avatarFileId,
            updatedAt: now,
          },
        )
        return normalizeParticipant(updated)
      }

      return normalizeParticipant(existing)
    }

    const created = await appwriteDatabases.createDocument<ParticipantDocument>(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTIONS.participants,
      appwriteId.unique(),
      {
        eventId,
        userId: currentUser.id,
        displayName: normalizedName,
        role,
        points: 0,
        joinedAt: now,
        updatedAt: now,
        avatarUrl,
        avatarFileId,
      },
      buildUserOwnedDocumentPermissions(currentUser.id),
    )

    return normalizeParticipant(created)
  },

  async updateParticipantProfile(
    participantId: string,
    payload: {
      displayName?: string
      avatarUrl?: string
      avatarFileId?: string
    },
  ): Promise<EventParticipant> {
    const nextAvatarUrl =
      payload.avatarUrl !== undefined || payload.avatarFileId !== undefined
        ? isAppwriteMode()
          ? resolveAvatarViewUrl(payload.avatarUrl, payload.avatarFileId) ?? ''
          : payload.avatarUrl ?? ''
        : undefined

    if (!isAppwriteMode()) {
      const participants = readParticipants()
      const participant = participants.find((item) => item.id === participantId)
      if (!participant) {
        throw new Error('Участник не найден.')
      }

      const updatedParticipant: EventParticipant = {
        ...participant,
        displayName:
          payload.displayName !== undefined
            ? payload.displayName.trim() || participant.displayName
            : participant.displayName,
        avatarUrl:
          nextAvatarUrl !== undefined ? nextAvatarUrl || undefined : participant.avatarUrl,
        avatarFileId:
          payload.avatarFileId !== undefined ? payload.avatarFileId || undefined : participant.avatarFileId,
        updatedAt: new Date().toISOString(),
      }

      persistParticipants(participants.map((item) => (item.id === participantId ? updatedParticipant : item)))
      return updatedParticipant
    }

    assertAppwriteReady('updateParticipantProfile')
    const existing = await findParticipantDocumentById(participantId)
    const updated = await appwriteDatabases.updateDocument<ParticipantDocument>(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTIONS.participants,
      participantId,
      {
        displayName:
          payload.displayName !== undefined
            ? payload.displayName.trim() || existing.displayName
            : existing.displayName,
        avatarUrl:
          nextAvatarUrl !== undefined
            ? nextAvatarUrl
            : resolveAvatarViewUrl(existing.avatarUrl, existing.avatarFileId) ?? '',
        avatarFileId:
          payload.avatarFileId !== undefined ? payload.avatarFileId ?? '' : existing.avatarFileId ?? '',
        updatedAt: new Date().toISOString(),
      },
    )

    return normalizeParticipant(updated)
  },

  async updateParticipantDisplayName(participantId: string, displayName: string): Promise<EventParticipant> {
    return this.updateParticipantProfile(participantId, { displayName })
  },

  async updateParticipantRole(participantId: string, role: 'organizer' | 'guest'): Promise<EventParticipant> {
    const now = new Date().toISOString()

    if (!isAppwriteMode()) {
      const participants = readParticipants()
      const existing = participants.find((item) => item.id === participantId)
      if (!existing) {
        throw new Error('Участник не найден.')
      }

      const updatedParticipant: EventParticipant = {
        ...existing,
        role,
        updatedAt: now,
      }

      persistParticipants(
        participants.map((item) => (item.id === updatedParticipant.id ? updatedParticipant : item)),
      )
      return updatedParticipant
    }

    assertAppwriteReady('updateParticipantRole')
    const existing = await findParticipantDocumentById(participantId)
    const updated = await appwriteDatabases.updateDocument<ParticipantDocument>(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTIONS.participants,
      participantId,
      {
        role,
        updatedAt: now,
      },
    )

    return normalizeParticipant(updated)
  },

  async addParticipantPoints(participantId: string, points: number): Promise<EventParticipant> {
    if (!isAppwriteMode()) {
      const participants = readParticipants()
      const participant = participants.find((item) => item.id === participantId)
      if (!participant) {
        throw new Error('Участник не найден.')
      }

      const updatedParticipant: EventParticipant = {
        ...participant,
        points: participant.points + points,
        updatedAt: new Date().toISOString(),
      }

      persistParticipants(participants.map((item) => (item.id === participantId ? updatedParticipant : item)))
      return updatedParticipant
    }

    assertAppwriteReady('addParticipantPoints')
    const existing = await findParticipantDocumentById(participantId)
    const updated = await appwriteDatabases.updateDocument<ParticipantDocument>(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTIONS.participants,
      participantId,
      {
        points: Number(existing.points ?? 0) + points,
        updatedAt: new Date().toISOString(),
      },
    )

    return normalizeParticipant(updated)
  },

  async reassignParticipationToUser(input: {
    participantId: string
    userId: string
    displayName: string
    avatarUrl?: string
    avatarFileId?: string
  }): Promise<EventParticipant> {
    const { avatarUrl, avatarFileId } = buildParticipantAvatarFields({
      avatarUrl: input.avatarUrl,
      avatarFileId: input.avatarFileId,
    })
    const now = new Date().toISOString()

    if (!isAppwriteMode()) {
      const participants = readParticipants()
      const participant = participants.find((item) => item.id === input.participantId)
      if (!participant) {
        throw new Error('Участник не найден.')
      }

      const updatedParticipant: EventParticipant = {
        ...participant,
        userId: input.userId,
        displayName: input.displayName.trim() || participant.displayName,
        avatarUrl: avatarUrl || undefined,
        avatarFileId: avatarFileId || undefined,
        updatedAt: now,
      }

      persistParticipants(
        participants.map((item) => (item.id === input.participantId ? updatedParticipant : item)),
      )
      return updatedParticipant
    }

    assertAppwriteReady('reassignParticipationToUser')
    const existing = await findParticipantDocumentById(input.participantId)
    const updated = await appwriteDatabases.updateDocument<ParticipantDocument>(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTIONS.participants,
      input.participantId,
      {
        displayName: input.displayName.trim() || existing.displayName,
        userId: input.userId,
        avatarUrl,
        avatarFileId,
        updatedAt: now,
      },
    )

    return normalizeParticipant(updated)
  },

  async leaveEvent(participantId: string): Promise<void> {
    if (!isAppwriteMode()) {
      persistParticipants(readParticipants().filter((item) => item.id !== participantId))
      return
    }

    assertAppwriteReady('leaveEvent')
    await appwriteDatabases.deleteDocument(APPWRITE_DATABASE_ID, APPWRITE_COLLECTIONS.participants, participantId)
  },

  removeLocalParticipationsForUser(userId: string) {
    if (isAppwriteMode()) return
    persistParticipants(readParticipants().filter((item) => item.userId !== userId))
  },

  // --- Слияние гостя в профиль: клон участия под profileUserId ---
  async cloneParticipationForProfileUser(input: {
    source: EventParticipant
    profileUserId: string
    profileDisplayName: string
    profileAvatarUrl?: string
    profileAvatarFileId?: string
  }): Promise<EventParticipant | null> {
    const existing = await this.getParticipant(input.source.eventId, input.profileUserId)
    if (existing) {
      return existing
    }

    const now = new Date().toISOString()

    if (!isAppwriteMode()) {
      const participants = readParticipants()
      const nextParticipant: EventParticipant = {
        id: createId('participant'),
        eventId: input.source.eventId,
        userId: input.profileUserId,
        displayName: input.profileDisplayName,
        role: input.source.role,
        points: input.source.points,
        joinedAt: input.source.joinedAt,
        updatedAt: now,
        avatarUrl: input.profileAvatarUrl || undefined,
        avatarFileId: input.profileAvatarFileId || undefined,
      }

      persistParticipants([
        ...participants.filter((item) => item.id !== input.source.id),
        nextParticipant,
      ])
      return nextParticipant
    }

    assertAppwriteReady('cloneParticipationForProfileUser')
    const created = await appwriteDatabases.createDocument<ParticipantDocument>(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTIONS.participants,
      appwriteId.unique(),
      {
        eventId: input.source.eventId,
        userId: input.profileUserId,
        displayName: input.profileDisplayName,
        role: input.source.role,
        points: input.source.points,
        joinedAt: input.source.joinedAt,
        updatedAt: now,
        avatarUrl: input.profileAvatarUrl ?? '',
        avatarFileId: input.profileAvatarFileId ?? '',
      },
      buildUserOwnedDocumentPermissions(input.profileUserId),
    )
    // Запись гостя удалить из профильной сессии нельзя (documentSecurity) — остаётся в БД.
    return normalizeParticipant(created)
  },
}
