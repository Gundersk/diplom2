// TODO: add Appwrite implementation when VITE_DATA_MODE=appwrite

import { getMockHomeEvents, normalizeGalleryEvent } from '../data/mockEvents'
import type { GalleryEvent } from '../types/event'

const HOME_EVENTS_STORAGE_KEY = 'event-gallery.home-events'

function canUseLocalStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function persistHomeEvents(events: GalleryEvent[]) {
  if (!canUseLocalStorage()) return

  const normalizedEvents = events.map((event) => normalizeGalleryEvent(event))
  window.localStorage.setItem(HOME_EVENTS_STORAGE_KEY, JSON.stringify(normalizedEvents))
}

function readStoredHomeEvents() {
  if (!canUseLocalStorage()) return null

  const stored = window.localStorage.getItem(HOME_EVENTS_STORAGE_KEY)
  if (!stored) return null

  try {
    const parsed = JSON.parse(stored)
    if (!Array.isArray(parsed)) {
      throw new Error('Stored home events payload is not an array.')
    }

    return parsed.map((event) => normalizeGalleryEvent(event as GalleryEvent))
  } catch {
    window.localStorage.removeItem(HOME_EVENTS_STORAGE_KEY)
    return null
  }
}

export const eventService = {
  getHomeEvents(): GalleryEvent[] {
    const storedEvents = readStoredHomeEvents()
    if (storedEvents) {
      return storedEvents
    }

    const mockEvents = getMockHomeEvents()
    persistHomeEvents(mockEvents)
    return mockEvents
  },

  createEvent(event: GalleryEvent): GalleryEvent {
    const normalizedEvent = normalizeGalleryEvent(event)
    const nextEvents = [...this.getHomeEvents(), normalizedEvent]
    persistHomeEvents(nextEvents)
    return normalizedEvent
  },

  updateEvent(event: GalleryEvent): GalleryEvent {
    const normalizedEvent = normalizeGalleryEvent(event)
    const existingEvents = this.getHomeEvents()
    const hasMatch = existingEvents.some((item) => item.id === normalizedEvent.id)
    const nextEvents = hasMatch
      ? existingEvents.map((item) => (item.id === normalizedEvent.id ? normalizedEvent : item))
      : [...existingEvents, normalizedEvent]

    persistHomeEvents(nextEvents)
    return normalizedEvent
  },

  deleteEvent(eventId: string) {
    const nextEvents = this.getHomeEvents().filter((event) => event.id !== eventId)
    persistHomeEvents(nextEvents)
  },
}
