/**
 * Сообщения чата события и нормализация отображаемых полей автора.
 */
export type EventChatMessage = {
  id: string
  eventId?: string
  userId?: string
  participantId?: string
  authorName: string
  authorAvatarUrl?: string
  authorInitials?: string
  text: string
  photoId?: string
  createdAt: string
  updatedAt?: string
}

export function buildChatInitials(name?: string) {
  return (
    name
      ?.split(/\s+/)
      .filter(Boolean)
      .map((part) => part.slice(0, 1))
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'Г'
  )
}

export function normalizeChatMessage(message: EventChatMessage): EventChatMessage {
  return {
    ...message,
    authorName: message.authorName || 'Гость',
    authorInitials: message.authorInitials ?? buildChatInitials(message.authorName),
    text: message.text ?? '',
    createdAt: message.createdAt ?? new Date().toISOString(),
    updatedAt: message.updatedAt,
  }
}
