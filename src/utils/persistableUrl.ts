/**
 * Проверка URL, пригодных для сохранения в БД или localStorage.
 * Исключает временные blob:/data: и слишком длинные строки.
 */
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
