export type CurrentUser = {
  id: string
  mode: 'guest' | 'profile'
  email?: string
  displayName?: string
  createdAt: string
  updatedAt?: string
}
