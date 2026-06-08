/**
 * Текущий пользователь сессии: демо, гость или профиль с email.
 */
export type CurrentUser = {
  id: string
  mode: 'demo' | 'guest' | 'profile'
  email?: string
  displayName?: string
  avatarUrl?: string
  avatarFileId?: string
  avatarEmoji?: string
  createdAt: string
  updatedAt?: string
}
