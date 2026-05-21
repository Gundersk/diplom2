// TODO: add Appwrite implementation when VITE_DATA_MODE=appwrite

import { authService } from './authService'
import type { EventParticipant } from '../types/participant'

const PARTICIPANTS_STORAGE_KEY = 'event-gallery:participants'

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

export const participantService = {
  async getParticipant(eventId: string, userId: string): Promise<EventParticipant | null> {
    return readParticipants().find((item) => item.eventId === eventId && item.userId === userId) ?? null
  },

  async getEventParticipants(eventId: string): Promise<EventParticipant[]> {
    return readParticipants().filter((item) => item.eventId === eventId)
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

    const participants = readParticipants()
    const existing = participants.find((item) => item.eventId === eventId && item.userId === currentUser.id)
    const normalizedName = displayName.trim() || currentUser.displayName || 'Гость'
    const now = new Date().toISOString()

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
  },

  async updateParticipantDisplayName(participantId: string, displayName: string): Promise<EventParticipant> {
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
  },

  async addParticipantPoints(participantId: string, points: number): Promise<EventParticipant> {
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
  },

  async leaveEvent(participantId: string): Promise<void> {
    persistParticipants(readParticipants().filter((item) => item.id !== participantId))
  },
}
