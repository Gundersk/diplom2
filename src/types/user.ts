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
