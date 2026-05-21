import { eventService } from './eventService'
import type { EventChatMessage } from '../types/chat'
import { buildChatInitials, normalizeChatMessage } from '../types/chat'

const CHAT_STORAGE_KEY = 'event-gallery:chat-messages'

function canUseLocalStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function createId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

function readStoredMessages(): EventChatMessage[] {
  if (!canUseLocalStorage()) return []

  const raw = window.localStorage.getItem(CHAT_STORAGE_KEY)
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      throw new Error('Stored chat messages payload is not an array.')
    }
    return parsed.map((message) => normalizeChatMessage(message as EventChatMessage))
  } catch {
    window.localStorage.removeItem(CHAT_STORAGE_KEY)
    return []
  }
}

function persistMessages(messages: EventChatMessage[]) {
  if (!canUseLocalStorage()) return
  window.localStorage.setItem(
    CHAT_STORAGE_KEY,
    JSON.stringify(messages.map((message) => normalizeChatMessage(message))),
  )
}

function migrateEventMessagesIfNeeded(eventId: string) {
  const stored = readStoredMessages()
  const existing = stored.filter((message) => message.eventId === eventId)
  if (existing.length > 0) {
    return existing
  }

  const event = eventService.getHomeEvents().find((item) => item.id === eventId)
  if (!event || event.chatMessages.length === 0) {
    return []
  }

  const migrated = event.chatMessages.map((message) =>
    normalizeChatMessage({
      ...message,
      eventId,
      createdAt: message.createdAt ?? event.startsAt,
    }),
  )

  persistMessages([...stored, ...migrated])
  return migrated
}

function updateStoredMessage(messageId: string, updater: (message: EventChatMessage) => EventChatMessage) {
  const messages = readStoredMessages()
  const index = messages.findIndex((message) => message.id === messageId)
  if (index === -1) {
    throw new Error('Сообщение не найдено.')
  }

  const nextMessage = normalizeChatMessage(updater(messages[index]))
  messages[index] = nextMessage
  persistMessages(messages)
  return nextMessage
}

export const chatService = {
  async getEventMessages(eventId: string): Promise<EventChatMessage[]> {
    const stored = readStoredMessages().filter((message) => message.eventId === eventId)
    if (stored.length > 0) {
      return stored
    }

    return migrateEventMessagesIfNeeded(eventId)
  },

  async addEventMessage(input: {
    eventId: string
    userId: string
    participantId: string
    authorName: string
    authorAvatarUrl?: string
    text: string
    photoId?: string
  }): Promise<EventChatMessage> {
    const nextMessage = normalizeChatMessage({
      id: createId('chat'),
      eventId: input.eventId,
      userId: input.userId,
      participantId: input.participantId,
      authorName: input.authorName,
      authorAvatarUrl: input.authorAvatarUrl,
      authorInitials: buildChatInitials(input.authorName),
      text: input.text,
      photoId: input.photoId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })

    persistMessages([...readStoredMessages(), nextMessage])
    return nextMessage
  },

  async updateMessage(messageId: string, text: string): Promise<EventChatMessage> {
    return updateStoredMessage(messageId, (message) => ({
      ...message,
      text,
      updatedAt: new Date().toISOString(),
    }))
  },

  async deleteMessage(messageId: string): Promise<void> {
    persistMessages(readStoredMessages().filter((message) => message.id !== messageId))
  },
}
