export function isPersistableUrl(value?: string) {
  return Boolean(value && !value.startsWith('data:') && !value.startsWith('blob:') && value.length <= 4096)
}

export function sanitizePersistableUrl(value?: string) {
  return isPersistableUrl(value) ? value! : ''
}
