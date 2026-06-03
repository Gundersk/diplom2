export const EVENT_TITLE_MIN_LENGTH = 1
export const EVENT_TITLE_MAX_LENGTH = 60
export const USER_NAME_MIN_LENGTH = 1
export const USER_NAME_MAX_LENGTH = 30

export function clampTextLength(value: string, maxLength: number) {
  return value.trim().slice(0, maxLength)
}

export function isValidEventTitle(value: string) {
  const trimmed = value.trim()
  return trimmed.length >= EVENT_TITLE_MIN_LENGTH && trimmed.length <= EVENT_TITLE_MAX_LENGTH
}

export function isValidUserName(value: string) {
  const trimmed = value.trim()
  return trimmed.length >= USER_NAME_MIN_LENGTH && trimmed.length <= USER_NAME_MAX_LENGTH
}
