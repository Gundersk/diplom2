import type { GalleryEvent } from '../types/event'

export function readInviteCodeFromLocation() {
  if (typeof window === 'undefined') {
    return ''
  }

  const url = new URL(window.location.href)
  return url.searchParams.get('event')?.trim().toUpperCase() ?? ''
}

export function readEventIdFromLocation() {
  if (typeof window === 'undefined') {
    return ''
  }

  const url = new URL(window.location.href)
  return url.searchParams.get('eventId')?.trim() ?? ''
}

export function clearEventNavigationFromUrl() {
  if (typeof window === 'undefined') {
    return
  }

  const url = new URL(window.location.href)
  url.searchParams.delete('event')
  url.searchParams.delete('eventId')
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
}

export function syncEventUrlInLocation(
  event: GalleryEvent | null | undefined,
  options: {
    isOrganizer: boolean
    inviteCodeFallback?: string | null
  },
) {
  if (typeof window === 'undefined') {
    return
  }

  const url = new URL(window.location.href)
  url.searchParams.delete('event')
  url.searchParams.delete('eventId')

  if (event) {
    if (options.isOrganizer) {
      const inviteCode = (event.inviteCode ?? options.inviteCodeFallback ?? '').trim().toUpperCase()
      if (inviteCode) {
        url.searchParams.set('event', inviteCode)
      }
    } else {
      url.searchParams.set('eventId', event.id)
    }
  }

  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
}
