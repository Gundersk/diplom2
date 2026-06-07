import { isLocalBlobRef } from './localBlobStorage'

export function isPersistableUrl(value?: string) {
  return Boolean(
    value &&
      !value.startsWith('data:') &&
      !value.startsWith('blob:') &&
      (isLocalBlobRef(value) || value.length <= 4096),
  )
}

export function sanitizePersistableUrl(value?: string) {
  return isPersistableUrl(value) ? value! : ''
}
