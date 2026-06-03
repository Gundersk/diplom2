import type { Models } from 'appwrite'
import { Permission, Role } from 'appwrite'
import { APPWRITE_COLLECTIONS, APPWRITE_DATABASE_ID } from '../config/appwriteSchema'
import { hasAppwriteRuntimeConfig } from '../config/runtime'
import { appwriteDatabases, appwriteId, appwriteQuery } from '../lib/appwrite'
import type { EventChatMessage } from '../types/chat'
import { buildChatInitials, normalizeChatMessage } from '../types/chat'
import { isAppwriteMode } from './adapters/dataMode'
import { resolveAvatarViewUrl } from '../utils/avatarUrl'
import { sanitizePersistableUrl } from '../utils/persistableUrl'
import { eventService } from './eventService'

const CHAT_STORAGE_KEY = 'event-gallery:chat-messages'

type ChatMessageDocument = Models.Document & {
  eventId: string
  userId: string
  participantId: string
  authorName: string
  authorAvatarUrl?: string
  authorInitials?: string
  text: string
  photoId?: string
  createdAt: string
  updatedAt?: string
}

function canUseLocalStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function createId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

function assertAppwriteReady(methodName: string) {
  if (!hasAppwriteRuntimeConfig() || !APPWRITE_DATABASE_ID) {
    const message =
      `[chatService] ${methodName} requires Appwrite runtime config and an existing chat_messages collection.`
    console.error(message)
    throw new Error('Appwrite mode is enabled, but the chat adapter is not configured yet.')
  }
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

function normalizeChatDocument(document: ChatMessageDocument): EventChatMessage {
  return normalizeChatMessage({
    id: document.$id,
    eventId: document.eventId,
    userId: document.userId,
    participantId: document.participantId,
    authorName: document.authorName,
    authorAvatarUrl: document.authorAvatarUrl,
    authorInitials: document.authorInitials || buildChatInitials(document.authorName),
    text: document.text,
    photoId: document.photoId,
    createdAt: document.createdAt ?? document.$createdAt,
    updatedAt: document.updatedAt ?? document.$updatedAt ?? document.$createdAt,
  })
}

async function migrateEventMessagesIfNeeded(eventId: string) {
  const stored = readStoredMessages()
  const existing = stored.filter((message) => message.eventId === eventId)
  if (existing.length > 0) {
    return existing
  }

  const events = await eventService.getHomeEvents()
  const event = events.find((item) => item.id === eventId)
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
    if (!isAppwriteMode()) {
      const stored = readStoredMessages().filter((message) => message.eventId === eventId)
      if (stored.length > 0) {
        return stored
      }

      return await migrateEventMessagesIfNeeded(eventId)
    }

    assertAppwriteReady('getEventMessages')
    const response = await appwriteDatabases.listDocuments<ChatMessageDocument>(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTIONS.chatMessages,
      [
        appwriteQuery.equal('eventId', eventId),
        appwriteQuery.limit(5000),
        appwriteQuery.orderAsc('createdAt'),
      ],
    )

    return response.documents.map((document) => normalizeChatDocument(document))
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
    if (!isAppwriteMode()) {
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
    }

    assertAppwriteReady('addEventMessage')
    const now = new Date().toISOString()
    const created = await appwriteDatabases.createDocument<ChatMessageDocument>(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTIONS.chatMessages,
      appwriteId.unique(),
      {
        eventId: input.eventId,
        userId: input.userId,
        participantId: input.participantId,
        authorName: input.authorName,
        authorAvatarUrl: sanitizePersistableUrl(input.authorAvatarUrl),
        authorInitials: buildChatInitials(input.authorName),
        text: input.text,
        photoId: input.photoId ?? '',
        createdAt: now,
        updatedAt: now,
      },
      [
        Permission.read(Role.users()),
        Permission.update(Role.user(input.userId)),
        Permission.delete(Role.user(input.userId)),
      ],
    )

    return normalizeChatDocument(created)
  },

  async updateMessage(messageId: string, text: string): Promise<EventChatMessage> {
    if (!isAppwriteMode()) {
      return updateStoredMessage(messageId, (message) => ({
        ...message,
        text,
        updatedAt: new Date().toISOString(),
      }))
    }

    assertAppwriteReady('updateMessage')
    const updated = await appwriteDatabases.updateDocument<ChatMessageDocument>(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTIONS.chatMessages,
      messageId,
      {
        text,
        updatedAt: new Date().toISOString(),
      },
    )

    return normalizeChatDocument(updated)
  },

  async syncAuthorProfileForUser(
    userId: string,
    profile: { displayName: string; avatarUrl?: string; avatarFileId?: string },
  ) {
    if (!isAppwriteMode()) {
      const authorName = profile.displayName.trim() || 'Гость'
      const authorAvatarUrl = profile.avatarUrl
      const messages = readStoredMessages().map((message) =>
        message.userId === userId
          ? normalizeChatMessage({
              ...message,
              authorName,
              authorAvatarUrl,
              authorInitials: buildChatInitials(authorName),
              updatedAt: new Date().toISOString(),
            })
          : message,
      )
      persistMessages(messages)
      return
    }

    assertAppwriteReady('syncAuthorProfileForUser')
    const authorName = profile.displayName.trim() || 'Гость'
    const authorAvatarUrl = resolveAvatarViewUrl(profile.avatarUrl, profile.avatarFileId) ?? ''
    const response = await appwriteDatabases.listDocuments<ChatMessageDocument>(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTIONS.chatMessages,
      [appwriteQuery.equal('userId', userId), appwriteQuery.limit(5000)],
    )

    await Promise.allSettled(
      response.documents.map((document) =>
        appwriteDatabases.updateDocument(
          APPWRITE_DATABASE_ID,
          APPWRITE_COLLECTIONS.chatMessages,
          document.$id,
          {
            authorName,
            authorAvatarUrl,
            authorInitials: buildChatInitials(authorName),
            updatedAt: new Date().toISOString(),
          },
        ),
      ),
    )
  },

  async deleteMessage(messageId: string): Promise<void> {
    if (!isAppwriteMode()) {
      persistMessages(readStoredMessages().filter((message) => message.id !== messageId))
      return
    }

    assertAppwriteReady('deleteMessage')
    await appwriteDatabases.deleteDocument(APPWRITE_DATABASE_ID, APPWRITE_COLLECTIONS.chatMessages, messageId)
  },
}
