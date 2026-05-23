import type { Models } from 'appwrite'
import { getMockHomeEvents, normalizeGalleryEvent } from '../data/mockEvents'
import { APPWRITE_COLLECTIONS, APPWRITE_DATABASE_ID } from '../config/appwriteSchema'
import { hasAppwriteRuntimeConfig } from '../config/runtime'
import { appwriteDatabases, appwriteId, appwriteQuery } from '../lib/appwrite'
import { isAppwriteMode } from './adapters/dataMode'
import { authService } from './authService'
import { participantService } from './participantService'
import { storageService } from './storageService'
import type { EventInfoBlock, EventPaymentInfo, EventRole, GalleryEvent } from '../types/event'

const HOME_EVENTS_STORAGE_KEY = 'event-gallery.home-events'
const INVITE_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

type EventDocument = Models.Document & {
  title: string
  description?: string
  startsAt?: string
  endsAt?: string
  timezone?: string
  location?: string
  createdAt?: string
  updatedAt?: string
  organizerId: string
  inviteCode: string
  coverUrl?: string
  coverFileId?: string
  backgroundFileId?: string
  backgroundUrl?: string
  backgroundMode?: string
  backgroundMediaType?: string
  backgroundColor?: string
  themeColor?: string
  accent?: string
  titleStyle?: string
  rsvpStyle?: string
  guestsCanInvite?: boolean
  maxParticipants?: number | null
  isPaid?: boolean
  costPerPerson?: string
  paymentDetails?: string
  paymentComment?: string
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

function buildInitials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || 'OR'
  )
}

async function resolveOrganizerDisplay(event: GalleryEvent) {
  if (!event.organizerId) {
    return event
  }

  const organizerParticipant = await participantService.getOrganizerParticipant(event.id, event.organizerId)
  if (!organizerParticipant?.displayName) {
    return event
  }

  const organizerName = organizerParticipant.displayName
  return normalizeGalleryEvent({
    ...event,
    organizerName,
    organizerInitials: buildInitials(organizerName),
  })
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
  const payment = normalizedEvent.payment ?? null
  const coverUrl =
    normalizedEvent.coverFileId || normalizedEvent.coverStart.startsWith('#')
      ? ''
      : normalizedEvent.coverStart
  const backgroundMode =
    normalizedEvent.backgroundMode ?? (normalizedEvent.backgroundStart.startsWith('#') ? 'color' : 'asset')
  const backgroundColor =
    backgroundMode === 'color'
      ? normalizedEvent.backgroundColor ?? normalizedEvent.backgroundStart
      : normalizedEvent.backgroundColor ?? ''
  const backgroundUrl =
    backgroundMode === 'color'
      ? ''
      : normalizedEvent.backgroundStart.startsWith('#')
        ? ''
        : normalizedEvent.backgroundStart
  const themeColor =
    backgroundMode === 'color'
      ? backgroundColor || normalizedEvent.accent
      : normalizedEvent.accent

  // organizerName is intentionally not stored in the events collection.
  // Organizer display data should come from participants/profiles or cached UI state.
  return {
    title: normalizedEvent.title,
    description: normalizedEvent.description ?? '',
    startsAt: normalizedEvent.startsAt || '',
    endsAt: normalizedEvent.endsAt || '',
    timezone: normalizedEvent.timezoneLabel ?? '',
    location: normalizedEvent.location ?? '',
    organizerId: normalizedEvent.organizerId ?? '',
    inviteCode: formatInviteCode(normalizedEvent.inviteCode) || normalizedEvent.id,
    coverUrl,
    coverFileId: normalizedEvent.coverFileId ?? '',
    backgroundFileId: normalizedEvent.backgroundFileId ?? '',
    backgroundUrl,
    backgroundMode,
    backgroundMediaType: normalizedEvent.backgroundMediaType ?? '',
    backgroundColor,
    themeColor,
    accent: normalizedEvent.accent ?? '',
    titleStyle: normalizedEvent.titleStyle ?? 'classic',
    rsvpStyle: normalizedEvent.rsvpStyle ?? 'icons',
    guestsCanInvite: Boolean(normalizedEvent.allowGuestInvites),
    maxParticipants: normalizedEvent.participantLimit ?? null,
    isPaid: Boolean(payment?.amount || payment?.destination || payment?.comment),
    costPerPerson: payment?.amount ?? '',
    paymentDetails: payment?.destination ?? '',
    paymentComment: payment?.comment ?? '',
    createdAt: normalizedEvent.createdAt ?? normalizedEvent.startsAt,
    updatedAt: normalizedEvent.updatedAt ?? new Date().toISOString(),
  }
}

function fromAppwriteEventDocument(
  document: EventDocument,
  participantRole?: 'organizer' | 'guest',
  currentUserId?: string,
) {
  const cachedEvent = getCachedEventUiState(document.$id)
  const coverPreviewUrl = document.coverFileId
    ? storageService.getFilePreviewUrl(document.coverFileId, 'cover')
    : ''
  const backgroundPreviewUrl = document.backgroundFileId
    ? storageService.getFilePreviewUrl(document.backgroundFileId, 'background')
    : ''
  const organizerFallbackName =
    cachedEvent?.organizerName ||
    (document.organizerId === currentUserId ? 'Вы' : '') ||
    document.organizerId ||
    'Организатор'
  const organizerFallbackInitials =
    cachedEvent?.organizerInitials ||
    organizerFallbackName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') ||
    'OR'
  const backgroundMode =
    document.backgroundMode === 'color' || document.backgroundMode === 'asset'
      ? document.backgroundMode
      : cachedEvent?.backgroundMode ?? 'asset'
  const backgroundMediaType =
    document.backgroundMediaType === 'video' || document.backgroundMediaType === 'gif' || document.backgroundMediaType === 'image'
      ? document.backgroundMediaType
      : cachedEvent?.backgroundMediaType
  const backgroundColor =
    document.backgroundColor ||
    (backgroundMode === 'color' ? document.themeColor || cachedEvent?.backgroundColor : cachedEvent?.backgroundColor)
  const accent = document.accent ?? cachedEvent?.accent ?? document.themeColor ?? '#ff7a59'
  const coverStart = coverPreviewUrl || cachedEvent?.coverStart || document.coverUrl || accent
  const coverEnd = coverPreviewUrl || cachedEvent?.coverEnd || document.coverUrl || accent
  const backgroundStart =
    backgroundMode === 'color'
      ? backgroundColor || cachedEvent?.backgroundStart || document.themeColor || '#f3f0ff'
      : backgroundPreviewUrl || document.backgroundUrl || cachedEvent?.backgroundStart || document.themeColor || accent || '#f3f0ff'
  const backgroundEnd =
    backgroundMode === 'color'
      ? cachedEvent?.backgroundEnd || '#fffaf6'
      : backgroundPreviewUrl || document.backgroundUrl || cachedEvent?.backgroundEnd || '#ffffff'

  if (import.meta.env.DEV) {
    console.log('[eventService] restored appwrite event background', {
      eventId: document.$id,
      backgroundUrl: document.backgroundUrl,
      backgroundFileId: document.backgroundFileId,
      restoredBackgroundStart: backgroundStart,
    })
  }

  const baseEvent: GalleryEvent = {
    id: document.$id,
    title: document.title,
    status: 'upcoming',
    startsAt: document.startsAt ?? document.$createdAt,
    endsAt: document.endsAt ?? document.startsAt ?? document.$createdAt,
    createdAt: document.createdAt ?? document.$createdAt,
    updatedAt: document.updatedAt ?? document.$updatedAt ?? document.$createdAt,
    role: getFallbackRole(
      {
        id: document.$id,
        title: document.title,
        status: 'upcoming',
        startsAt: document.startsAt ?? document.$createdAt,
        endsAt: document.endsAt ?? document.startsAt ?? document.$createdAt,
        role: cachedEvent?.role ?? 'Участник',
        organizerId: document.organizerId || undefined,
        organizerName: organizerFallbackName,
        organizerInitials: organizerFallbackInitials,
        organizerTone: cachedEvent?.organizerTone ?? '#ffd166,#41d3bd',
        organizerAvatarSrc: cachedEvent?.organizerAvatarSrc,
        location: document.location ?? '',
        savedCount: 0,
        totalCount: 0,
        coverStart,
        coverEnd,
        backgroundStart,
        backgroundEnd,
        accent,
        achievements: [],
        photos: [],
        chatMessages: [],
        guestRsvps: [],
      } as GalleryEvent,
      currentUserId,
      participantRole,
    ),
    organizerId: document.organizerId || undefined,
    organizerName: organizerFallbackName,
    organizerInitials: organizerFallbackInitials,
    organizerTone: cachedEvent?.organizerTone ?? '#ffd166,#41d3bd',
    organizerAvatarSrc: cachedEvent?.organizerAvatarSrc || undefined,
    inviteCode: document.inviteCode || document.$id,
    description: document.description ?? '',
    location: document.location ?? '',
    savedCount: 0,
    totalCount: 0,
    coverFileId: document.coverFileId || undefined,
    backgroundFileId: document.backgroundFileId || undefined,
    backgroundUrl: document.backgroundUrl || undefined,
    coverStart,
    coverEnd,
    backgroundStart,
    backgroundEnd,
    backgroundMode,
    backgroundMediaType: backgroundMode === 'color' ? undefined : backgroundMediaType,
    backgroundColor: backgroundMode === 'color' ? backgroundColor || undefined : undefined,
    accent,
    allowGuestInvites: Boolean(document.guestsCanInvite),
    participantLimit: document.maxParticipants ?? null,
    infoBlocks: cachedEvent?.infoBlocks ?? [],
    payment: document.isPaid
      ? {
          amount: document.costPerPerson ?? '',
          destination: document.paymentDetails ?? '',
          comment: document.paymentComment ?? '',
        }
      : cachedEvent?.payment ?? null,
    timezoneLabel: document.timezone ?? cachedEvent?.timezoneLabel ?? 'Екатеринбург (UTC+5)',
    titleStyle: document.titleStyle ?? cachedEvent?.titleStyle ?? 'classic',
    rsvpStyle: document.rsvpStyle ?? cachedEvent?.rsvpStyle ?? 'icons',
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

function compareEventsByStartDate(first: GalleryEvent, second: GalleryEvent) {
  return new Date(first.startsAt).getTime() - new Date(second.startsAt).getTime()
}

async function getDocumentsByIds(documentIds: string[]) {
  const uniqueDocumentIds = [...new Set(documentIds.filter(Boolean))]
  if (uniqueDocumentIds.length === 0) {
    return [] as EventDocument[]
  }

  const results = await Promise.allSettled(
    uniqueDocumentIds.map((documentId) =>
      appwriteDatabases.getDocument<EventDocument>(
        APPWRITE_DATABASE_ID,
        APPWRITE_COLLECTIONS.events,
        documentId,
      ),
    ),
  )

  return results.flatMap((result) => {
    if (result.status === 'fulfilled') {
      return [result.value]
    }

    console.warn('[eventService] Failed to load linked event document.', result.reason)
    return []
  })
}

async function getHomeEventsFromAppwrite() {
  assertAppwriteReady('getHomeEvents')

  const participantMap = await getCurrentUserParticipantMap()
  if (!participantMap.currentUserId) {
    persistHomeEvents([])
    return []
  }

  const [organizerEventsResponse, participantEventsDocuments] = await Promise.all([
    appwriteDatabases.listDocuments<EventDocument>(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTIONS.events,
      [
        appwriteQuery.equal('organizerId', participantMap.currentUserId),
        appwriteQuery.limit(5000),
        appwriteQuery.orderAsc('startsAt'),
      ],
    ),
    getDocumentsByIds([...participantMap.rolesByEventId.keys()]),
  ])

  const linkedDocuments = new Map<string, EventDocument>()
  for (const document of organizerEventsResponse.documents) {
    linkedDocuments.set(document.$id, document)
  }
  for (const document of participantEventsDocuments) {
    linkedDocuments.set(document.$id, document)
  }

  const events = (
    await Promise.all(
      [...linkedDocuments.values()].map(async (document) =>
        await resolveOrganizerDisplay(
          fromAppwriteEventDocument(
            document,
            participantMap.rolesByEventId.get(document.$id),
            participantMap.currentUserId,
          ),
        ),
      ),
    )
  ).sort(compareEventsByStartDate)

  persistHomeEvents(events)
  return events
}

function updateCachedEvent(event: GalleryEvent) {
  const cachedEvents = readStoredHomeEvents() ?? []
  const nextEvents = cachedEvents.some((item) => item.id === event.id)
    ? cachedEvents.map((item) => (item.id === event.id ? event : item))
    : [...cachedEvents, event]
  persistHomeEvents(nextEvents)
}

function cacheCreatedEventIfLinked(event: GalleryEvent, currentUserId?: string) {
  if (!currentUserId) {
    return
  }

  if (event.organizerId === currentUserId) {
    updateCachedEvent(event)
  }
}

function removeCachedEvent(eventId: string) {
  const cachedEvents = readStoredHomeEvents() ?? []
  persistHomeEvents(cachedEvents.filter((event) => event.id !== eventId))
}

async function getAppwriteEventById(eventId: string) {
  assertAppwriteReady('getEventById')

  const participantMap = await getCurrentUserParticipantMap()
  const document = await appwriteDatabases.getDocument<EventDocument>(
    APPWRITE_DATABASE_ID,
    APPWRITE_COLLECTIONS.events,
    eventId,
  )

  const event = await resolveOrganizerDisplay(
    fromAppwriteEventDocument(
      document,
      participantMap.rolesByEventId.get(document.$id),
      participantMap.currentUserId,
    ),
  )

  updateCachedEvent(event)
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

  const event = await resolveOrganizerDisplay(
    fromAppwriteEventDocument(
      document,
      participantMap.rolesByEventId.get(document.$id),
      participantMap.currentUserId,
    ),
  )

  updateCachedEvent(event)

  return event
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

    if (import.meta.env.DEV) {
      console.log('[eventService] create payload background', {
        backgroundMode: payload.backgroundMode,
        backgroundMediaType: payload.backgroundMediaType,
        backgroundFileId: payload.backgroundFileId,
        backgroundUrl: payload.backgroundUrl,
        backgroundStart: normalizedEvent.backgroundStart,
      })
    }

    await appwriteDatabases.createDocument<EventDocument>(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTIONS.events,
      normalizedEvent.id || appwriteId.unique(),
      payload,
    )

    const currentUser = await authService.getCurrentUser()
    const cachePayload = normalizeGalleryEvent({
      ...normalizedEvent,
      achievements: [],
      photos: [],
      chatMessages: [],
      guestRsvps: [],
    })
    cacheCreatedEventIfLinked(cachePayload, currentUser?.id)
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

    if (import.meta.env.DEV) {
      console.log('[eventService] update payload background', {
        backgroundMode: payload.backgroundMode,
        backgroundMediaType: payload.backgroundMediaType,
        backgroundFileId: payload.backgroundFileId,
        backgroundUrl: payload.backgroundUrl,
        backgroundStart: normalizedEvent.backgroundStart,
      })
    }

    await appwriteDatabases.updateDocument<EventDocument>(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTIONS.events,
      normalizedEvent.id,
      payload,
    )

    updateCachedEvent(normalizedEvent)
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

    removeCachedEvent(eventId)
  },
}

