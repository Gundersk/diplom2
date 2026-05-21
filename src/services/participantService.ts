import type { Models } from 'appwrite'
import { APPWRITE_COLLECTIONS, APPWRITE_DATABASE_ID } from '../config/appwriteSchema'
import { hasAppwriteRuntimeConfig } from '../config/runtime'
import { appwriteDatabases, appwriteId, appwriteQuery } from '../lib/appwrite'
import type { EventParticipant } from '../types/participant'
import { isAppwriteMode } from './adapters/dataMode'
import { authService } from './authService'

const PARTICIPANTS_STORAGE_KEY = 'event-gallery:participants'

type ParticipantDocument = Models.Document & {
  eventId: string
  userId: string
  displayName: string
  role: 'organizer' | 'guest'
  points: number
  joinedAt: string
  updatedAt?: string
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
  }
}

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

    return response.documents.map((document) => normalizeParticipant(document))
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
    const now = new Date().toISOString()

    if (!isAppwriteMode()) {
      const participants = readParticipants()
      const existing = participants.find((item) => item.eventId === eventId && item.userId === currentUser.id)

      if (existing) {
        const updatedParticipant: EventParticipant = {
          ...existing,
          displayName: normalizedName,
          role,
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
      }

      persistParticipants([...participants, participant])
      return participant
    }

    assertAppwriteReady('joinEventAsParticipant')
    const existing = await findParticipantDocument(eventId, currentUser.id)

    if (existing) {
      if (existing.displayName !== normalizedName || existing.role !== role) {
        const updated = await appwriteDatabases.updateDocument<ParticipantDocument>(
          APPWRITE_DATABASE_ID,
          APPWRITE_COLLECTIONS.participants,
          existing.$id,
          {
            displayName: normalizedName,
            role,
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
      },
    )

    return normalizeParticipant(created)
  },

  async updateParticipantDisplayName(participantId: string, displayName: string): Promise<EventParticipant> {
    if (!isAppwriteMode()) {
      const participants = readParticipants()
      const participant = participants.find((item) => item.id === participantId)
      if (!participant) {
        throw new Error('Участник не найден.')
      }

      const updatedParticipant: EventParticipant = {
        ...participant,
        displayName: displayName.trim() || participant.displayName,
        updatedAt: new Date().toISOString(),
      }

      persistParticipants(participants.map((item) => (item.id === participantId ? updatedParticipant : item)))
      return updatedParticipant
    }

    assertAppwriteReady('updateParticipantDisplayName')
    const existing = await findParticipantDocumentById(participantId)
    const updated = await appwriteDatabases.updateDocument<ParticipantDocument>(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTIONS.participants,
      participantId,
      {
        displayName: displayName.trim() || existing.displayName,
        updatedAt: new Date().toISOString(),
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

  async leaveEvent(participantId: string): Promise<void> {
    if (!isAppwriteMode()) {
      persistParticipants(readParticipants().filter((item) => item.id !== participantId))
      return
    }

    assertAppwriteReady('leaveEvent')
    await appwriteDatabases.deleteDocument(APPWRITE_DATABASE_ID, APPWRITE_COLLECTIONS.participants, participantId)
  },
}

