import type { Models } from 'appwrite'
import { getMockHomeEvents, normalizeGalleryEvent } from '../data/mockEvents'
import { APPWRITE_COLLECTIONS, APPWRITE_DATABASE_ID } from '../config/appwriteSchema'
import { hasAppwriteRuntimeConfig } from '../config/runtime'
import { appwriteDatabases, appwriteId, appwriteQuery } from '../lib/appwrite'
import { isAppwriteMode } from './adapters/dataMode'
import { authService } from './authService'
import type { EventInfoBlock, EventPaymentInfo, EventRole, GalleryEvent } from '../types/event'

const HOME_EVENTS_STORAGE_KEY = 'event-gallery.home-events'
const INVITE_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

type EventDocument = Models.Document & {
  title: string
  description?: string
  startsAt: string
  endsAt: string
  createdAt?: string
  updatedAt?: string
  organizerId?: string
  organizerName: string
  organizerInitials: string
  organizerTone: string
  organizerAvatarSrc?: string
  inviteCode?: string
  location?: string
  coverStart?: string
  coverEnd?: string
  backgroundStart?: string
  backgroundEnd?: string
  accent?: string
  allowGuestInvites?: boolean
  participantLimit?: number | null
  infoBlocksJson?: string
  paymentJson?: string
  timezoneLabel?: string
  titleStyle?: string
  rsvpStyle?: string
}

type ParticipantRoleDocument = Models.Document & {
  eventId: string
  userId: string
  role: 'organizer' | 'guest'
}

function canUseLocalStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function randomInviteChunk(length = 4) {
  return Array.from({ length }, () => INVITE_CODE_CHARS[Math.floor(Math.random() * INVITE_CODE_CHARS.length)]).join('')
}

function formatInviteCode(code?: string) {
  return code?.trim().toUpperCase() || ''
}

export function generateInviteCode(startsAt?: string) {
  const date = startsAt ? new Date(startsAt) : null
  const month = date
    ? date
        .toLocaleString('en-US', { month: 'short' })
        .replace(/[^A-Za-z]/g, '')
        .slice(0, 3)
        .toUpperCase()
    : 'EVT'
  const day = date && !Number.isNaN(date.getTime()) ? String(date.getDate()).padStart(2, '0') : ''
  return `${month}${day ? `-${day}` : ''}-${randomInviteChunk(4)}`
}

export function getEventInviteUrl(event: GalleryEvent) {
  const inviteCode = formatInviteCode(event.inviteCode || event.id)
  if (typeof window === 'undefined') {
    return `/?event=${encodeURIComponent(inviteCode)}`
  }

  const url = new URL(window.location.href)
  url.searchParams.set('event', inviteCode)
  url.hash = ''
  return url.toString()
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

function assertAppwriteReady(methodName: string) {
  if (!hasAppwriteRuntimeConfig() || !APPWRITE_DATABASE_ID) {
    const message =
      `[eventService] ${methodName} requires Appwrite runtime config and an existing database/collections setup.`
    console.error(message)
    throw new Error('Appwrite mode is enabled, but the events adapter is not configured yet.')
  }
}

function parseInfoBlocks(value?: string): EventInfoBlock[] {
  if (!value) return []

  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? (parsed as EventInfoBlock[]) : []
  } catch {
    return []
  }
}

function parsePayment(value?: string): EventPaymentInfo | null {
  if (!value) return null

  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' ? (parsed as EventPaymentInfo) : null
  } catch {
    return null
  }
}

function getFallbackRole(event: GalleryEvent, currentUserId?: string, participantRole?: 'organizer' | 'guest'): EventRole {
  if (participantRole === 'organizer' || (currentUserId && event.organizerId === currentUserId)) {
    return 'Организатор'
  }

  return 'Участник'
}

function getCachedEventUiState(eventId: string) {
  return readStoredHomeEvents()?.find((event) => event.id === eventId) ?? null
}

function mergeEventWithCachedUiState(
  baseEvent: GalleryEvent,
  cachedEvent?: GalleryEvent | null,
  participantRole?: 'organizer' | 'guest',
  currentUserId?: string,
) {
  const uiState = cachedEvent ?? getCachedEventUiState(baseEvent.id)
  const nextEvent = normalizeGalleryEvent({
    ...baseEvent,
    role: getFallbackRole(baseEvent, currentUserId, participantRole),
    achievements: uiState?.achievements ?? baseEvent.achievements ?? [],
    photos: uiState?.photos ?? baseEvent.photos ?? [],
    chatMessages: uiState?.chatMessages ?? baseEvent.chatMessages ?? [],
    guestRsvps: uiState?.guestRsvps ?? baseEvent.guestRsvps ?? [],
    savedCount:
      uiState?.savedCount ??
      (uiState?.photos ?? baseEvent.photos ?? []).filter((photo) => photo.saved).length,
    totalCount: uiState?.totalCount ?? (uiState?.photos ?? baseEvent.photos ?? []).length,
  })

  return nextEvent
}

function normalizeLocalEvents(events: GalleryEvent[]) {
  return events.map((event) => normalizeGalleryEvent(event))
}

async function findExistingInviteCodeInAppwrite(inviteCode: string) {
  const response = await appwriteDatabases.listDocuments<EventDocument>(
    APPWRITE_DATABASE_ID,
    APPWRITE_COLLECTIONS.events,
    [
      appwriteQuery.equal('inviteCode', inviteCode),
      appwriteQuery.limit(1),
    ],
  )

  return response.documents[0] ?? null
}

async function ensureInviteCode(event: GalleryEvent) {
  const existingInviteCode = formatInviteCode(event.inviteCode)
  if (existingInviteCode) {
    return existingInviteCode
  }

  if (!isAppwriteMode()) {
    const usedCodes = new Set(
      getLocalHomeEvents()
        .map((item) => formatInviteCode(item.inviteCode))
        .filter(Boolean),
    )

    let nextCode = generateInviteCode(event.startsAt)
    while (usedCodes.has(nextCode)) {
      nextCode = generateInviteCode(event.startsAt)
    }
    return nextCode
  }

  assertAppwriteReady('ensureInviteCode')

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const nextCode = generateInviteCode(event.startsAt)
    const existing = await findExistingInviteCodeInAppwrite(nextCode)
    if (!existing) {
      return nextCode
    }
  }

  return generateInviteCode(event.startsAt)
}

function toAppwriteEventPayload(event: GalleryEvent) {
  const normalizedEvent = normalizeGalleryEvent(event)

  return {
    title: normalizedEvent.title,
    description: normalizedEvent.description ?? '',
    startsAt: normalizedEvent.startsAt,
    endsAt: normalizedEvent.endsAt,
    createdAt: normalizedEvent.createdAt ?? normalizedEvent.startsAt,
    updatedAt: normalizedEvent.updatedAt ?? new Date().toISOString(),
    organizerId: normalizedEvent.organizerId ?? '',
    organizerName: normalizedEvent.organizerName,
    organizerInitials: normalizedEvent.organizerInitials,
    organizerTone: normalizedEvent.organizerTone,
    organizerAvatarSrc: normalizedEvent.organizerAvatarSrc ?? '',
    inviteCode: formatInviteCode(normalizedEvent.inviteCode) || normalizedEvent.id,
    location: normalizedEvent.location ?? '',
    coverStart: normalizedEvent.coverStart,
    coverEnd: normalizedEvent.coverEnd,
    backgroundStart: normalizedEvent.backgroundStart,
    backgroundEnd: normalizedEvent.backgroundEnd,
    accent: normalizedEvent.accent,
    allowGuestInvites: Boolean(normalizedEvent.allowGuestInvites),
    participantLimit: normalizedEvent.participantLimit ?? null,
    infoBlocksJson: JSON.stringify(normalizedEvent.infoBlocks ?? []),
    paymentJson: JSON.stringify(normalizedEvent.payment ?? null),
    timezoneLabel: normalizedEvent.timezoneLabel ?? '',
    titleStyle: normalizedEvent.titleStyle ?? 'classic',
    rsvpStyle: normalizedEvent.rsvpStyle ?? 'icons',
  }
}

function fromAppwriteEventDocument(
  document: EventDocument,
  participantRole?: 'organizer' | 'guest',
  currentUserId?: string,
) {
  const baseEvent: GalleryEvent = {
    id: document.$id,
    title: document.title,
    status: 'upcoming',
    startsAt: document.startsAt,
    endsAt: document.endsAt,
    createdAt: document.createdAt ?? document.startsAt,
    updatedAt: document.updatedAt ?? document.$updatedAt ?? document.$createdAt,
    role: 'Участник',
    organizerId: document.organizerId || undefined,
    organizerName: document.organizerName ?? 'Организатор',
    organizerInitials: document.organizerInitials ?? document.organizerName?.slice(0, 1) ?? 'О',
    organizerTone: document.organizerTone ?? '#ffd166,#41d3bd',
    organizerAvatarSrc: document.organizerAvatarSrc || undefined,
    inviteCode: document.inviteCode || document.$id,
    description: document.description ?? '',
    location: document.location ?? '',
    savedCount: 0,
    totalCount: 0,
    coverStart: document.coverStart ?? '#ff7a59',
    coverEnd: document.coverEnd ?? document.coverStart ?? '#ffd166',
    backgroundStart: document.backgroundStart ?? document.coverStart ?? '#ff7a59',
    backgroundEnd: document.backgroundEnd ?? document.coverEnd ?? document.coverStart ?? '#ffd166',
    accent: document.accent ?? '#ff7a59',
    allowGuestInvites: Boolean(document.allowGuestInvites),
    participantLimit: document.participantLimit ?? null,
    infoBlocks: parseInfoBlocks(document.infoBlocksJson),
    payment: parsePayment(document.paymentJson),
    timezoneLabel: document.timezoneLabel ?? 'Екатеринбург (UTC+5)',
    titleStyle: document.titleStyle ?? 'classic',
    rsvpStyle: document.rsvpStyle ?? 'icons',
    achievements: [],
    photos: [],
    chatMessages: [],
    guestRsvps: [],
  }

  return mergeEventWithCachedUiState(baseEvent, undefined, participantRole, currentUserId)
}

async function getCurrentUserParticipantMap() {
  const currentUser = await authService.getCurrentUser()
  if (!currentUser?.id) {
    return {
      currentUserId: undefined,
      rolesByEventId: new Map<string, 'organizer' | 'guest'>(),
    }
  }

  const response = await appwriteDatabases.listDocuments<ParticipantRoleDocument>(
    APPWRITE_DATABASE_ID,
    APPWRITE_COLLECTIONS.participants,
    [
      appwriteQuery.equal('userId', currentUser.id),
      appwriteQuery.limit(5000),
    ],
  )

  return {
    currentUserId: currentUser.id,
    rolesByEventId: new Map(response.documents.map((document) => [document.eventId, document.role])),
  }
}

async function getHomeEventsFromAppwrite() {
  assertAppwriteReady('getHomeEvents')

  const [eventsResponse, participantMap] = await Promise.all([
    appwriteDatabases.listDocuments<EventDocument>(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTIONS.events,
      [appwriteQuery.limit(5000), appwriteQuery.orderAsc('startsAt')],
    ),
    getCurrentUserParticipantMap(),
  ])

  const events = eventsResponse.documents.map((document) =>
    fromAppwriteEventDocument(
      document,
      participantMap.rolesByEventId.get(document.$id),
      participantMap.currentUserId,
    ),
  )

  persistHomeEvents(events)
  return events
}

function getLocalHomeEvents() {
  const storedEvents = readStoredHomeEvents()
  if (storedEvents) {
    return storedEvents
  }

  const mockEvents = getMockHomeEvents()
  persistHomeEvents(mockEvents)
  return mockEvents
}

async function getLocalEventById(eventId: string) {
  return getLocalHomeEvents().find((event) => event.id === eventId) ?? null
}

async function getLocalEventByInviteCode(inviteCode: string) {
  const normalizedCode = formatInviteCode(inviteCode)
  if (!normalizedCode) return null

  return (
    getLocalHomeEvents().find((event) => formatInviteCode(event.inviteCode || event.id) === normalizedCode) ?? null
  )
}

async function getAppwriteEventById(eventId: string) {
  assertAppwriteReady('getEventById')

  const participantMap = await getCurrentUserParticipantMap()
  const document = await appwriteDatabases.getDocument<EventDocument>(
    APPWRITE_DATABASE_ID,
    APPWRITE_COLLECTIONS.events,
    eventId,
  )

  const event = fromAppwriteEventDocument(
    document,
    participantMap.rolesByEventId.get(document.$id),
    participantMap.currentUserId,
  )

  const cachedEvents = readStoredHomeEvents() ?? []
  const nextEvents = cachedEvents.some((item) => item.id === event.id)
    ? cachedEvents.map((item) => (item.id === event.id ? event : item))
    : [...cachedEvents, event]
  persistHomeEvents(nextEvents)

  return event
}

async function getAppwriteEventByInviteCode(inviteCode: string) {
  assertAppwriteReady('getEventByInviteCode')

  const normalizedCode = formatInviteCode(inviteCode)
  if (!normalizedCode) {
    return null
  }

  const participantMap = await getCurrentUserParticipantMap()
  const response = await appwriteDatabases.listDocuments<EventDocument>(
    APPWRITE_DATABASE_ID,
    APPWRITE_COLLECTIONS.events,
    [
      appwriteQuery.equal('inviteCode', normalizedCode),
      appwriteQuery.limit(2),
    ],
  )

  if (response.documents.length > 1) {
    console.warn(`[eventService] Multiple events found for inviteCode=${normalizedCode}. Using the first document.`)
  }

  const document = response.documents[0]
  if (!document) {
    return null
  }

  const event = fromAppwriteEventDocument(
    document,
    participantMap.rolesByEventId.get(document.$id),
    participantMap.currentUserId,
  )

  const cachedEvents = readStoredHomeEvents() ?? []
  const nextEvents = cachedEvents.some((item) => item.id === event.id)
    ? cachedEvents.map((item) => (item.id === event.id ? event : item))
    : [...cachedEvents, event]
  persistHomeEvents(nextEvents)

  return event
}

export const eventService = {
  async getHomeEvents(): Promise<GalleryEvent[]> {
    return isAppwriteMode() ? getHomeEventsFromAppwrite() : getLocalHomeEvents()
  },

  async getEventById(eventId: string): Promise<GalleryEvent | null> {
    return isAppwriteMode() ? getAppwriteEventById(eventId) : getLocalEventById(eventId)
  },

  async getEventByInviteCode(inviteCode: string): Promise<GalleryEvent | null> {
    return isAppwriteMode()
      ? getAppwriteEventByInviteCode(inviteCode)
      : getLocalEventByInviteCode(inviteCode)
  },

  async createEvent(event: GalleryEvent): Promise<GalleryEvent> {
    const normalizedEvent = normalizeGalleryEvent({
      ...event,
      inviteCode: await ensureInviteCode(event),
    })

    if (!isAppwriteMode()) {
      const nextEvents = [...getLocalHomeEvents(), normalizedEvent]
      persistHomeEvents(nextEvents)
      return normalizedEvent
    }

    assertAppwriteReady('createEvent')
    const payload = toAppwriteEventPayload(normalizedEvent)

    await appwriteDatabases.createDocument<EventDocument>(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTIONS.events,
      normalizedEvent.id || appwriteId.unique(),
      payload,
    )

    const cachedEvents = readStoredHomeEvents() ?? []
    const nextEvents = [...cachedEvents.filter((item) => item.id !== normalizedEvent.id), normalizedEvent]
    persistHomeEvents(nextEvents)
    return normalizedEvent
  },

  async updateEvent(event: GalleryEvent): Promise<GalleryEvent> {
    const normalizedEvent = normalizeGalleryEvent({
      ...event,
      inviteCode: await ensureInviteCode(event),
    })

    if (!isAppwriteMode()) {
      const existingEvents = getLocalHomeEvents()
      const hasMatch = existingEvents.some((item) => item.id === normalizedEvent.id)
      const nextEvents = hasMatch
        ? existingEvents.map((item) => (item.id === normalizedEvent.id ? normalizedEvent : item))
        : [...existingEvents, normalizedEvent]

      persistHomeEvents(nextEvents)
      return normalizedEvent
    }

    assertAppwriteReady('updateEvent')
    const payload = toAppwriteEventPayload(normalizedEvent)

    await appwriteDatabases.updateDocument<EventDocument>(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTIONS.events,
      normalizedEvent.id,
      payload,
    )

    const cachedEvents = readStoredHomeEvents() ?? []
    const nextEvents = cachedEvents.some((item) => item.id === normalizedEvent.id)
      ? cachedEvents.map((item) => (item.id === normalizedEvent.id ? normalizedEvent : item))
      : [...cachedEvents, normalizedEvent]
    persistHomeEvents(nextEvents)
    return normalizedEvent
  },

  cacheEventState(event: GalleryEvent): GalleryEvent {
    const normalizedEvent = normalizeGalleryEvent(event)
    const cachedEvents = readStoredHomeEvents() ?? []
    const nextEvents = cachedEvents.some((item) => item.id === normalizedEvent.id)
      ? cachedEvents.map((item) => (item.id === normalizedEvent.id ? normalizedEvent : item))
      : [...cachedEvents, normalizedEvent]

    persistHomeEvents(nextEvents)
    return normalizedEvent
  },

  async deleteEvent(eventId: string): Promise<void> {
    if (!isAppwriteMode()) {
      const nextEvents = getLocalHomeEvents().filter((event) => event.id !== eventId)
      persistHomeEvents(nextEvents)
      return
    }

    assertAppwriteReady('deleteEvent')

    const participantsResponse = await appwriteDatabases.listDocuments<ParticipantRoleDocument>(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTIONS.participants,
      [appwriteQuery.equal('eventId', eventId), appwriteQuery.limit(5000)],
    )

    await Promise.all(
      participantsResponse.documents.map((document) =>
        appwriteDatabases.deleteDocument(APPWRITE_DATABASE_ID, APPWRITE_COLLECTIONS.participants, document.$id),
      ),
    )

    await appwriteDatabases.deleteDocument(APPWRITE_DATABASE_ID, APPWRITE_COLLECTIONS.events, eventId)

    const cachedEvents = readStoredHomeEvents() ?? []
    persistHomeEvents(cachedEvents.filter((event) => event.id !== eventId))
  },
}
