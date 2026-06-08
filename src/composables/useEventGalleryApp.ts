import 'emoji-picker-element'
import { computed, nextTick, onUnmounted, reactive, ref, watch } from 'vue'
import { buildEventStatus } from '../utils/galleryEvent'
import { authService, LOCAL_DEMO_USER_DISPLAY_NAME } from '../services/authService'
import { achievementService } from '../services/achievementService'
import { chatService } from '../services/chatService'
import { eventService, getEventInviteUrl } from '../services/eventService'
import { participantService } from '../services/participantService'
import { photoService } from '../services/photoService'
import { rsvpService } from '../services/rsvpService'
import {
  isSupportedAutomaticTemplateId,
  processAutomaticAchievementsForEvent,
} from '../services/automaticAchievementService'
import { savedPhotoService } from '../services/savedPhotoService'
import { storageService } from '../services/storageService'
import { isAppwriteMode } from '../services/adapters/dataMode'
import { resolveAvatarViewUrl, withAvatarCacheToken } from '../utils/avatarUrl'
import { isLocalBlobRef, replaceLocalImageFile, resolveLocalBlobUrl } from '../utils/localBlobStorage'
import { isMergedGuestUserId, resolveCanonicalUserId } from '../utils/mergedGuestIds'
import { repairProfileOrganizerOwnership } from '../services/guestMergeService'
import { sanitizePersistableUrl } from '../utils/persistableUrl'
import {
  getEventBackgroundScrimClass,
  getEventTextThemeClass,
  resolveEventTextTheme,
  type EventTextThemeSource,
} from '../utils/eventTextTheme'
import {
  canSetGoingRsvp,
  EVENT_CAPACITY_FULL_MESSAGE,
  isEventAtCapacity,
} from '../utils/eventCapacity'
import {
  clampTextLength,
  EVENT_TITLE_MAX_LENGTH,
  isValidUserName,
  USER_NAME_MAX_LENGTH,
} from '../utils/textLimits'
import type {
  AchievementScope,
  AchievementTemplate,
  AchievementVisibility,
  EventAchievement,
  ParticipantAchievement,
  MedalForm,
} from '../types/achievement'
import type {
  AssetOption,
  BackgroundMediaType,
  EventInfoBlock,
  EventPaymentInfo,
  EventTab,
  EventTextThemeSetting,
  EventTheme,
  GalleryEvent,
  HomeNotification,
  RsvpChoice,
  RsvpStatus,
} from '../types/event'
import type { EventParticipant } from '../types/participant'
import type { GalleryPhoto } from '../types/photo'
import type { EventChatMessage } from '../types/chat'
import type { EventRsvpEntry } from '../types/rsvp'
import type { CurrentUser } from '../types/user'
import { useInviteFlow } from './useInviteFlow'
import { buildEmptyCreateEventForm, useCreateEventForm } from './useCreateEventForm'
import {
  eventTextThemeOptions,
  formatTimezoneLabel,
  getInfoBlockTypeLabel,
  quickInfoOptions,
  rsvpStyleOptions,
  russianTimezoneOptions,
  softBackgroundColors,
  titleStyleOptions,
} from '../data/createEventFormOptions'
import { padNumber } from '../utils/createEventDateTime'
import {
  clearEventNavigationFromUrl,
  readEventIdFromLocation,
  readInviteCodeFromLocation,
  syncEventUrlInLocation,
} from '../utils/eventInviteNavigation'

/**
 * Главный composable приложения Event Gallery.
 * Собирает auth, home, создание события, страницу события, фото, RSVP, чат и достижения.
 * Режим данных (local / appwrite) определяется в services/adapters/dataMode.ts.
 */
export function useEventGalleryApp() {
type AuthMode = 'guest' | 'profile'
type ViewMode = 'home' | 'create' | 'preview' | 'event'
type PhotoViewerMode = 'home' | 'event-album'
type PhotoViewerEntry = { event: GalleryEvent; photo: GalleryPhoto }
type CurrentUserView = CurrentUser & {
  initials: string
  name: string
  role: 'Организатор'
  avatarStorageRef?: string
}

const themes: EventTheme[] = [
  {
    id: 'sunset',
    name: 'Вечер',
    mood: 'теплая встреча',
    emoji: '🌇',
    start: '#ff7a59',
    mid: '#ffd166',
    end: '#41d3bd',
    accent: '#ff4d6d',
    ink: '#241013',
  },
  {
    id: 'fresh',
    name: 'Студенты',
    mood: 'яркий кампус',
    emoji: '🎓',
    start: '#00c2a8',
    mid: '#f7f06d',
    end: '#5b8def',
    accent: '#008f7a',
    ink: '#06251f',
  },
  {
    id: 'neon',
    name: 'Квест',
    mood: 'ночная игра',
    emoji: '⚡',
    start: '#151515',
    mid: '#8a5cf6',
    end: '#ffb703',
    accent: '#ffb703',
    ink: '#111111',
  },
]

const notifications = ref<HomeNotification[]>([
  {
    id: 'n1',
    title: 'Объявление в событии',
    text: 'Организатор обновил место встречи для фото-вечера.',
    time: '5 мин',
  },
  {
    id: 'n2',
    title: 'Новое достижение',
    text: 'Вы получили медаль "Папарацци" за активность в альбоме.',
    time: '18 мин',
  },
  {
    id: 'n3',
    title: 'Ответ в чате',
    text: 'В выпускном вечере появился новый ответ на ваше сообщение.',
    time: '1 С‡',
  },
])

const achievementTemplates = ref<AchievementTemplate[]>([])

const medalToneOptions = [
  '#ff7a59,#ffd166',
  '#41d3bd,#5b8def',
  '#5b8def,#f7f06d',
  '#ff4d6d,#ffffff',
  '#8a5cf6,#ffb703',
  '#151515,#ffffff',
]

const emojiPickerOptions = [
  '🏅',
  '📸',
  '⭐',
  '💎',
  '✨',
  '👥',
  '🎉',
  '🌟',
  '🧠',
  '🌿',
  '🪩',
  '🎭',
  '🎧',
  '🫶',
  '🔥',
  '📚',
]

function buildUserInitials(name?: string) {
  return (
    name
      ?.split(/\s+/)
      .filter(Boolean)
      .map((part) => part.slice(0, 1))
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'G'
  )
}

function inferBackgroundMediaTypeFromSource(source?: string): BackgroundMediaType {
  if (!source) return 'image'

  if (/\.(mp4|webm)(\?.*)?$/i.test(source)) {
    return 'video'
  }

  if (/\.gif(\?.*)?$/i.test(source)) {
    return 'gif'
  }

  return 'image'
}

function getAssetBackgroundMediaType(asset?: AssetOption | null): BackgroundMediaType {
  if (!asset) return 'image'
  if (asset.kind === 'video') return 'video'
  if (asset.category === 'gif' || /\.gif(\?.*)?$/i.test(asset.src)) return 'gif'
  return 'image'
}

function getBackgroundMediaTypeFromFile(file: File): BackgroundMediaType {
  const normalizedType = file.type.toLowerCase()

  if (normalizedType === 'video/mp4' || normalizedType === 'video/webm' || normalizedType.startsWith('video/')) {
    return 'video'
  }

  if (normalizedType === 'image/gif') {
    return 'gif'
  }

  return 'image'
}

function getAvatarStyle(avatarUrl?: string, cacheToken?: string) {
  if (!avatarUrl) return undefined

  const resolvedUrl = withAvatarCacheToken(avatarUrl, cacheToken)
  return {
    backgroundImage: `url("${resolvedUrl}")`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  }
}

const currentUser = reactive<CurrentUserView>({
  id: 'guest_demo',
  mode: 'demo',
  displayName: LOCAL_DEMO_USER_DISPLAY_NAME,
  avatarUrl: undefined,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  initials: buildUserInitials(LOCAL_DEMO_USER_DISPLAY_NAME),
  name: LOCAL_DEMO_USER_DISPLAY_NAME,
  role: 'Организатор',
})

function hasRealAuthenticatedUser() {
  if (!currentUser.id || currentUser.id === 'anonymous') return false
  if (isAppwriteMode()) {
    return currentUser.mode === 'guest' || currentUser.mode === 'profile'
  }
  return true
}

function createAnonymousUserPlaceholder(): CurrentUser {
  const now = new Date().toISOString()
  return {
    id: 'anonymous',
    mode: 'guest',
    displayName: '',
    createdAt: now,
    updatedAt: now,
  }
}

// --- Пресеты обложек и фонов (src/assets/event-presets) для формы создания ---
const coverAssetModules = import.meta.glob(
  '../assets/event-presets/covers/**/*.{png,jpg,jpeg,jfif,avif,webp,gif}',
  {
    eager: true,
    import: 'default',
  },
) as Record<string, string>

const backgroundAssetModules = import.meta.glob(
  '../assets/event-presets/backgrounds/*.{png,jpg,jpeg,jfif,avif,webp,mp4,webm}',
  {
    eager: true,
    import: 'default',
  },
) as Record<string, string>

function buildAssetOptions(
  assets: Record<string, string>,
  kindResolver?: (path: string) => 'image' | 'video',
) {
  return Object.entries(assets)
    .sort(([firstPath], [secondPath]) => firstPath.localeCompare(secondPath, 'ru'))
    .map(([path, src], index) => {
      const fileName = path.split('/').pop() ?? `asset-${index + 1}`
      return {
        id: `asset-${index + 1}`,
        kind: kindResolver?.(path) ?? 'image',
        category: path.includes('/gif/') || path.toLowerCase().endsWith('.gif') ? 'gif' : 'poster',
        label: fileName.replace(/\.[^.]+$/, ''),
        src,
      } satisfies AssetOption
    })
}

const coverAssetOptions = buildAssetOptions(coverAssetModules)
const backgroundAssetOptions = buildAssetOptions(backgroundAssetModules, (path) =>
  path.endsWith('.mp4') || path.endsWith('.webm') ? 'video' : 'image',
)

function getCreateFormAssetDefaults() {
  return {
    coverAssetId: coverAssetOptions[0]?.id ?? '',
    backgroundAssetId: backgroundAssetOptions[0]?.id ?? '',
    backgroundMediaType: getAssetBackgroundMediaType(backgroundAssetOptions[0]),
  }
}

function createEmptyEventForm() {
  return buildEmptyCreateEventForm(currentUser.name, getCreateFormAssetDefaults())
}

const {
  createEventForm,
  backgroundColorHue,
  resetForm: resetCreateEventForm,
  enforceCreateDateTimeRules,
  applyBackgroundColor,
  updateBackgroundFromHue,
  setCreatePaymentEnabled,
  hourOptions,
  minuteOptions,
  availableEndHours,
  availableEndMinutes,
  startDateTime,
  endDateTime,
  endBeforeStart,
  canSaveEvent,
} = useCreateEventForm({
  getHostAlias: () => currentUser.name,
  getAssetDefaults: getCreateFormAssetDefaults,
})

function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36)}`
}

function getCurrentUserAvatarUrlForDocuments() {
  if (isAppwriteMode()) {
    return resolveAvatarViewUrl(currentUser.avatarUrl, currentUser.avatarFileId)
  }

  return currentUser.avatarUrl
}

function hasCurrentUserAvatarVisual() {
  return Boolean(getCurrentUserAvatarUrlForDocuments())
}

function getParticipantAvatarUrl(
  participant?: (Pick<EventParticipant, 'avatarUrl' | 'avatarFileId' | 'userId'> | null),
) {
  if (!participant) return undefined
  if (participant.userId && resolveCanonicalUserId(participant.userId, currentUser.id) === currentUser.id) {
    return getCurrentUserAvatarUrlForDocuments() || resolveAvatarViewUrl(participant.avatarUrl, participant.avatarFileId)
  }
  return resolveAvatarViewUrl(participant.avatarUrl, participant.avatarFileId)
}

function getParticipantDisplayName(participant?: Pick<EventParticipant, 'displayName' | 'userId'> | null) {
  if (!participant) return 'Гость'
  if (participant.userId && resolveCanonicalUserId(participant.userId, currentUser.id) === currentUser.id) {
    return currentUser.displayName?.trim() || currentUser.name || participant.displayName || 'Гость'
  }
  return participant.displayName || 'Гость'
}

function getAvatarCacheToken(participant?: Pick<EventParticipant, 'avatarFileId' | 'updatedAt'> | null) {
  return participant?.avatarFileId || participant?.updatedAt || currentUser.avatarFileId || currentUser.updatedAt
}

function getCurrentAuthorAvatarUrl(participant?: EventParticipant | null) {
  return getParticipantAvatarUrl(participant) || getCurrentUserAvatarUrlForDocuments()
}

async function getPersistableAuthorAvatarUrl(participant?: EventParticipant | null) {
  if (isAppwriteMode()) {
    return getCurrentAuthorAvatarUrl(participant)
  }

  if (
    participant?.userId &&
    resolveCanonicalUserId(participant.userId, currentUser.id) === currentUser.id
  ) {
    return currentUser.avatarStorageRef ?? (await authService.getCurrentUser())?.avatarUrl
  }

  const participantAvatarUrl = participant?.avatarUrl
  if (isLocalBlobRef(participantAvatarUrl) || sanitizePersistableUrl(participantAvatarUrl)) {
    return participantAvatarUrl
  }

  return undefined
}

function findParticipantForAuthor(eventId: string | undefined, message: Pick<EventChatMessage, 'participantId' | 'userId' | 'eventId'>) {
  const resolvedEventId = eventId || activeEventId.value || message.eventId
  if (!resolvedEventId) return null

  const participants = eventParticipantsByEventId.value[resolvedEventId] ?? []
  const canonicalUserId = message.userId
    ? resolveCanonicalUserId(message.userId, currentUser.id)
    : undefined

  return (
    participants.find((participant) => participant.id === message.participantId) ??
    participants.find((participant) => canonicalUserId && participant.userId === canonicalUserId) ??
    participants.find((participant) => participant.userId === message.userId) ??
    null
  )
}

function findParticipantForUser(eventId: string | undefined, userId?: string) {
  if (!userId) return null
  const resolvedEventId = eventId || activeEventId.value
  if (!resolvedEventId) return null

  const canonicalUserId = resolveCanonicalUserId(userId, currentUser.id)
  return (
    eventParticipantsByEventId.value[resolvedEventId]?.find(
      (participant) => participant.userId === canonicalUserId || participant.userId === userId,
    ) ?? null
  )
}

function getMessageAuthorAvatarUrl(message: EventChatMessage, eventId?: string) {
  if (message.userId && resolveCanonicalUserId(message.userId, currentUser.id) === currentUser.id) {
    return getCurrentUserAvatarUrlForDocuments()
  }

  const participant = findParticipantForAuthor(eventId, message)
  const fromParticipant = getParticipantAvatarUrl(participant)
  if (fromParticipant) return fromParticipant

  if (!message.authorAvatarUrl) return undefined
  return isAppwriteMode()
    ? sanitizePersistableUrl(message.authorAvatarUrl) || undefined
    : message.authorAvatarUrl
}

function getRsvpEntryAvatarUrl(entry: EventRsvpEntry, eventId?: string) {
  if (entry.userId && resolveCanonicalUserId(entry.userId, currentUser.id) === currentUser.id) {
    return getCurrentUserAvatarUrlForDocuments()
  }

  const participant = findParticipantForUser(eventId, entry.userId)
  const fromParticipant = getParticipantAvatarUrl(participant)
  if (fromParticipant) return fromParticipant

  if (!entry.avatarUrl) return undefined
  return isAppwriteMode() ? sanitizePersistableUrl(entry.avatarUrl) || undefined : entry.avatarUrl
}

function applyOrganizerAvatarToEvent(event: GalleryEvent, participant: EventParticipant) {
  const avatarSrc = getParticipantAvatarUrl(participant)
  return {
    ...event,
    organizerName: participant.displayName || event.organizerName,
    organizerInitials: buildUserInitials(participant.displayName || event.organizerName),
    organizerAvatarSrc: avatarSrc,
  }
}

function getCreateFormBackgroundStart() {
  if (createEventForm.value.backgroundMode === 'color') {
    return createEventForm.value.backgroundColor
  }

  return (
    createEventForm.value.uploadedBackgroundUrl ||
    selectedBackgroundAsset.value?.src ||
    createEventForm.value.backgroundColor
  )
}

function getEventTextThemeSourceFromForm(): EventTextThemeSource {
  return {
    textTheme: createEventForm.value.textTheme,
    backgroundMode: createEventForm.value.backgroundMode,
    backgroundColor: createEventForm.value.backgroundColor,
    backgroundStart: getCreateFormBackgroundStart(),
    backgroundMediaType:
      createEventForm.value.backgroundMode === 'color'
        ? undefined
        : createEventForm.value.uploadedBackgroundUrl
          ? createEventForm.value.backgroundMediaType
          : getAssetBackgroundMediaType(selectedBackgroundAsset.value),
  }
}

function getEventTextThemeClassForEvent(event?: GalleryEvent | null) {
  if (!event) {
    return getEventTextThemeClass('light')
  }
  return getEventTextThemeClass(resolveEventTextTheme(event))
}

function getEventBackgroundScrimClassForEvent(event?: GalleryEvent | null) {
  if (!event) {
    return getEventBackgroundScrimClass({
      textTheme: 'light',
      backgroundMode: 'color',
      backgroundColor: '#f4efe7',
      backgroundStart: '#f4efe7',
    })
  }
  return getEventBackgroundScrimClass(event)
}

function getEventBackgroundScrimClassForForm() {
  return getEventBackgroundScrimClass(getEventTextThemeSourceFromForm())
}

function getResolvedTextThemeLabel(theme: ReturnType<typeof resolveEventTextTheme>) {
  return theme === 'dark' ? 'тёмный текст' : 'светлый текст'
}

function normalizeFormTextTheme(
  textTheme: EventTextThemeSetting | undefined,
  source?: EventTextThemeSource,
): 'light' | 'dark' {
  if (textTheme === 'light' || textTheme === 'dark') {
    return textTheme
  }
  return source ? resolveEventTextTheme(source) : 'light'
}

function applyCurrentUser(user: CurrentUser) {
  currentUser.id = user.id
  currentUser.mode = user.mode
  currentUser.email = user.email
  currentUser.displayName = user.displayName
  currentUser.avatarStorageRef = isLocalBlobRef(user.avatarUrl) ? user.avatarUrl : undefined
  currentUser.avatarFileId = user.avatarFileId
  currentUser.createdAt = user.createdAt
  currentUser.updatedAt = user.updatedAt
  currentUser.avatarEmoji = user.avatarEmoji
  currentUser.name =
    user.displayName?.trim() ||
    (user.mode === 'demo' ? LOCAL_DEMO_USER_DISPLAY_NAME : `Гость ${String(user.id).slice(-4)}`)
  currentUser.initials = buildUserInitials(currentUser.name)
  void refreshCurrentUserAvatarDisplay(user.avatarUrl, user.avatarFileId)
  void loadAchievementTemplates()
}

async function refreshCurrentUserAvatarDisplay(storedAvatarUrl?: string, avatarFileId?: string) {
  if (isAppwriteMode()) {
    currentUser.avatarUrl = resolveAvatarViewUrl(storedAvatarUrl, avatarFileId)
    return
  }

  if (isLocalBlobRef(storedAvatarUrl)) {
    currentUser.avatarUrl = await resolveLocalBlobUrl(storedAvatarUrl, { force: true })
    return
  }

  if (storedAvatarUrl?.startsWith('blob:') || storedAvatarUrl?.startsWith('data:')) {
    currentUser.avatarUrl = storedAvatarUrl
    return
  }

  currentUser.avatarUrl = sanitizePersistableUrl(storedAvatarUrl) || undefined
}

async function syncPastEventAutomaticAchievements() {
  for (const event of homeEvents.value) {
    if (buildEventStatus(event.startsAt, event.endsAt) !== 'past') {
      continue
    }

    const [photos, achievements, participants, awards] = await Promise.all([
      photoService.getEventPhotos(event.id, currentUser.id),
      achievementService.getEventAchievements(event.id),
      participantService.getEventParticipants(event.id),
      achievementService.getEventAchievementAwards(event.id),
    ])

    eventParticipantsByEventId.value = {
      ...eventParticipantsByEventId.value,
      [event.id]: participants,
    }

    const eventSnapshot = {
      ...event,
      photos,
      achievements,
    }
    const normalizedAwards = normalizeParticipantAwards(eventSnapshot, awards)
    const awardsChanged = await processAutomaticAchievementsForEvent({
      event: eventSnapshot,
      photos,
      achievements,
      participants,
      awards: normalizedAwards,
      awardedByUserId: event.organizerId || currentUser.id,
    })

    if (awardsChanged) {
      await syncEventAchievementAwardsFromService(event.id)
    }
  }
}

// --- Первичная загрузка после входа: события, шаблоны достижений, автонаграды ---
async function loadInitialAppData() {
  await loadHomeEvents()
  await syncAllEventPhotosFromService()
  await syncAllEventRsvpsFromService()
  await syncAllEventMessagesFromService()
  await syncAllEventAchievementsFromService()
  await syncAllEventParticipantsFromService()
  await syncAllEventAchievementAwardsFromService()
  await syncPastEventAutomaticAchievements()
}

async function loadAchievementTemplates() {
  const templates = await achievementService.getAchievementTemplates()
  achievementTemplates.value = templates.filter(
    (template) => template.scope !== 'automatic' || isSupportedAutomaticTemplateId(template.id),
  )
}

async function loadHomeEvents() {
  if (isAppwriteMode() && hasRealAuthenticatedUser() && currentUser.id) {
    try {
      await repairProfileOrganizerOwnership(currentUser.id)
    } catch (error) {
      console.warn('[App] repair organizer ownership failed', error)
    }
  }

  homeEvents.value = await eventService.getHomeEvents()
  return homeEvents.value
}

function replaceHomeEvent(nextEvent: GalleryEvent) {
  syncEventSavedCount(nextEvent)
  eventService.cacheEventState(nextEvent)
  upsertHomeEvent(nextEvent)
  return nextEvent
}

function upsertHomeEvent(event: GalleryEvent) {
  homeEvents.value = homeEvents.value.some((item) => item.id === event.id)
    ? homeEvents.value.map((item) => (item.id === event.id ? event : item))
    : [...homeEvents.value, event]
}

async function copyInviteLink(event: GalleryEvent) {
  const inviteUrl = getEventInviteUrl(event)

  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(inviteUrl)
      inviteLinkStatus.value = 'Ссылка скопирована'
    } else {
      inviteLinkStatus.value = inviteUrl
    }
  } catch {
    inviteLinkStatus.value = inviteUrl
  }

  notifications.value = [
    {
      id: createId('notice'),
      title: 'Ссылка-приглашение',
      text: inviteLinkStatus.value === 'Ссылка скопирована' ? inviteUrl : `Скопируйте ссылку: ${inviteUrl}`,
      time: 'сейчас',
    },
    ...notifications.value,
  ]
}

function toDateParts(value: string) {
  const date = new Date(value)
  return {
    date: value.slice(0, 10),
    hour: padNumber(date.getHours()),
    minute: padNumber(date.getMinutes()),
  }
}

function onEmojiPickerSelect(event: Event) {
  const detail = (event as CustomEvent<{ unicode: string }>).detail
  medalForm.value.icon = detail.unicode
  emojiPickerOpen.value = false
}

function createEmptyInfoBlock(): EventInfoBlock {
  return {
    id: createId('block'),
    type: 'dress-code',
    icon: '👔',
    title: '',
    description: '',
    link: '',
  }
}

function createEmptyMedalForm(): MedalForm {
  return {
    title: '',
    description: '',
    scope: 'personal',
    icon: '🏅',
    tone: medalToneOptions[0],
    visibility: 'visible',
    saveAsTemplate: true,
  }
}

function formatEventDateLabel(startsAt: string) {
  const date = new Date(startsAt)
  const now = new Date()
  const isSameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()

  if (isSameDay) {
    return `Сегодня, ${date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`
  }

  return date.toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatShortEventDate(startsAt: string) {
  const date = new Date(startsAt)
  const now = new Date()
  const isSameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()

  if (isSameDay) {
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  }

  return date.toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
  })
}

function canExpandOnHome(event: GalleryEvent) {
  return event.status === 'current' || event.status === 'past'
}

function canShowHomeAchievements(event: GalleryEvent) {
  return canExpandOnHome(event) && getHomeAwardedAchievements(event).length > 0
}

function getSavedPhotos(event: GalleryEvent) {
  return event.photos.filter((photo) => photo.saved)
}

function getPhotoImageSource(photo: GalleryPhoto) {
  return photo.imageUrl ?? photo.src ?? ''
}

function getPhotoThumbToneStyle(photo: GalleryPhoto) {
  if (getPhotoImageSource(photo)) return undefined
  return { '--photo-tone': photo.tone }
}

function formatPhotoPostedLabel(photo: GalleryPhoto) {
  const stamp = photo.createdAt || photo.updatedAt
  if (!stamp) return 'Дата не указана'
  return formatEventDateLabel(stamp)
}

function getPhotoAuthorLabel(photo: GalleryPhoto) {
  return photo.authorName?.trim() || 'Участник'
}

function buildHomePhotoPlaylist(): PhotoViewerEntry[] {
  const entries: PhotoViewerEntry[] = []

  for (const event of visibleEvents.value) {
    if (!canExpandOnHome(event)) continue

    for (const photo of getSavedPhotos(event)) {
      entries.push({ event, photo })
    }
  }

  return entries
}

function syncEventSavedCount(event: GalleryEvent) {
  event.savedCount = getSavedPhotos(event).length
  event.totalCount = event.photos.length
}

function isAssetSource(value: string) {
  return (
    /^(blob:|data:|https?:\/\/)/i.test(value) ||
    value.includes('/storage/buckets/') ||
    /\.(png|jpe?g|jfif|webp|avif|gif|mp4|webm)(\?.*)?$/i.test(value)
  )
}

function isVideoBackground(event: Pick<GalleryEvent, 'backgroundMode' | 'backgroundMediaType' | 'backgroundStart'>) {
  if (event.backgroundMode === 'color') {
    return false
  }

  if (event.backgroundMediaType) {
    return event.backgroundMediaType === 'video'
  }

  return inferBackgroundMediaTypeFromSource(event.backgroundStart) === 'video'
}

function captureVideoPosterFrame(src: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    video.preload = 'auto'

    if (!src.startsWith('blob:') && !src.startsWith('data:')) {
      video.crossOrigin = 'anonymous'
    }

    video.src = src

    const cleanup = () => {
      video.removeAttribute('src')
      video.load()
    }

    video.addEventListener(
      'loadeddata',
      () => {
        const seekTo = video.duration ? Math.min(0.2, video.duration * 0.04) : 0.12
        video.currentTime = seekTo
      },
      { once: true },
    )

    video.addEventListener(
      'seeked',
      () => {
        try {
          const canvas = document.createElement('canvas')
          const width = video.videoWidth || 1280
          const height = video.videoHeight || 720
          canvas.width = width
          canvas.height = height
          const context = canvas.getContext('2d')
          if (!context) {
            throw new Error('Не удалось подготовить кадр видео.')
          }

          context.drawImage(video, 0, 0, width, height)
          canvas.toBlob(
            (blob) => {
              cleanup()
              if (!blob) {
                reject(new Error('Не удалось получить кадр видео.'))
                return
              }
              resolve(URL.createObjectURL(blob))
            },
            'image/jpeg',
            0.82,
          )
        } catch (error) {
          cleanup()
          reject(error)
        }
      },
      { once: true },
    )

    video.addEventListener(
      'error',
      () => {
        cleanup()
        reject(new Error('Не удалось загрузить видео для фона.'))
      },
      { once: true },
    )
  })
}

function usesGradientEventBackground(event: GalleryEvent) {
  return !isAssetSource(event.backgroundStart) || event.backgroundStart.startsWith('#')
}

function getEventSurfaceStyle(start: string, end: string) {
  if (isAssetSource(start)) {
    return {
      background: `url("${start}") center / cover no-repeat`,
    }
  }

  if (start.startsWith('#')) {
    return { background: start }
  }

  return {
    background: `linear-gradient(135deg, ${start}, ${end})`,
  }
}

function buildAchievementFromTemplate(template: AchievementTemplate): EventAchievement {
  return {
    id: createId(template.id),
    templateId: template.id,
    title: template.title,
    description: template.description,
    icon: template.icon,
    tone: template.tone,
    scope: template.scope,
    mode: template.mode,
    points: template.points,
    selected: true,
    visibility: template.visibility ?? 'visible',
    createdBy: currentUser.id,
    createdAt: new Date().toISOString(),
    conditionType: template.conditionType,
  }
}

const homeEvents = ref<GalleryEvent[]>([])
const authOpen = ref(false)
const authMode = ref<AuthMode>('guest')
const authGuestName = ref('')
const authEmail = ref('')
const authCode = ref('')
const authError = ref('')
const authEmailCodeRequested = ref(false)
const authEmailDelivery = ref<'appwrite' | 'local-dev' | null>(null)
const appInitializing = ref(true)
const currentView = ref<ViewMode>('home')
const guestPersistBannerDismissed = ref(
  typeof window !== 'undefined' &&
    window.sessionStorage.getItem('event-gallery:guest-banner-dismissed') === '1',
)
const activeTab = ref<EventTab>('current')
const profileMenuOpen = ref(false)
const notificationsOpen = ref(false)
const expandedEvents = ref<Set<string>>(new Set())
const selectedPhoto = ref<{ eventId: string; photoId: string } | null>(null)
const photoViewerMode = ref<PhotoViewerMode>('home')
const viewerEventBackgroundImage = ref('')
const viewerEventBackgroundGradient = ref(false)
let viewerBackgroundObjectUrl: string | null = null
const activeAchievement = ref<string | null>(null)
const createEventOpen = ref(false)
const medalBuilderOpen = ref(false)
const activeEventId = ref<string | null>(null)
const inviteLinkStatus = ref('')
const previewDraftEvent = ref<GalleryEvent | null>(null)
const eventChatDraft = ref('')
const editingEventId = ref<string | null>(null)
const eventSaveInProgress = ref(false)
const rsvpSheetOpen = ref(false)
const rsvpSheetStatus = ref<RsvpStatus | null>(null)
const rsvpSheetMessage = ref('')
const highlightedGuestRsvpId = ref<string | null>(null)
let eventGuestSyncTimer: ReturnType<typeof setInterval> | null = null
const albumPhotoInput = ref<HTMLInputElement | null>(null)
const chatPhotoInput = ref<HTMLInputElement | null>(null)
const profileAvatarInput = ref<HTMLInputElement | null>(null)
const pendingAlbumEventId = ref<string | null>(null)
const profileEditorOpen = ref(false)
const profileEditorName = ref('')
const profileEditorAvatarPreviewUrl = ref<string | null>(null)
const profileEditorAvatarFile = ref<File | null>(null)
let profileAvatarPreviewObjectUrl: string | null = null
const profileEditorError = ref('')
const eventParticipantsByEventId = ref<Record<string, EventParticipant[]>>({})
const eventAchievementAwardsByEventId = ref<Record<string, ParticipantAchievement[]>>({})
const achievementAwardModalOpen = ref(false)
const achievementAwardEventId = ref<string | null>(null)
const achievementAwardTarget = ref<EventAchievement | null>(null)
const achievementAwardSelections = ref<string[]>([])
const achievementAwardError = ref('')
const achievementsPanelOpen = ref(false)
const openEventAchievementId = ref<string | null>(null)

void loadAchievementTemplates()

const showGuestPersistBanner = computed(
  () =>
    currentUser.mode === 'guest' &&
    hasRealAuthenticatedUser() &&
    !guestPersistBannerDismissed.value,
)

const rsvpStatusLabels: Record<RsvpStatus, string> = {
  going: 'Пойду',
  maybe: 'Возможно',
  'not-going': 'Не смогу',
}
const coverPickerOpen = ref(false)
const coverPickerTab = ref<'posters' | 'gifs'>('posters')
const coverSearchQuery = ref('')
const uploadedCoverFile = ref<File | null>(null)
const uploadedBackgroundFile = ref<File | null>(null)
const emojiPickerOpen = ref(false)
const createAchievementPopover = ref<string | null>(null)
const createAchievementPopoverAnchor = ref<DOMRect | null>(null)
let createAchievementPopoverListenersAttached = false
const medalForm = ref<MedalForm>(createEmptyMedalForm())

const visibleEvents = computed(() =>
  [...homeEvents.value]
    .filter((event) => event.status === activeTab.value)
    .sort(
      (first, second) =>
        new Date(first.startsAt).getTime() - new Date(second.startsAt).getTime(),
    ),
)

const totalSavedPhotos = computed(() =>
  homeEvents.value.reduce((sum, event) => sum + event.savedCount, 0),
)
const totalMedals = computed(() =>
  homeEvents.value.reduce((sum, event) => sum + event.achievements.length, 0),
)

const flatPhotos = computed(() => {
  if (!selectedPhoto.value) return []

  if (photoViewerMode.value === 'event-album') {
    const event = getEventById(selectedPhoto.value.eventId)
    if (!event) return []
    return event.photos.map((photo) => ({ event, photo }))
  }

  return buildHomePhotoPlaylist()
})

const expandableVisibleEvents = computed(() => visibleEvents.value.filter((event) => canExpandOnHome(event)))

const allVisibleExpanded = computed(
  () =>
    expandableVisibleEvents.value.length > 0 &&
    expandableVisibleEvents.value.every((event) => expandedEvents.value.has(event.id)),
)

const activeEvent = computed(
  () => homeEvents.value.find((event) => event.id === activeEventId.value) ?? null,
)
const currentParticipant = ref<EventParticipant | null>(null)

const eventPageData = computed(() => {
  if (currentView.value === 'preview') return previewDraftEvent.value
  if (currentView.value === 'event') return activeEvent.value
  return null
})

const activeEventParticipants = computed(() =>
  activeEventId.value ? eventParticipantsByEventId.value[activeEventId.value] ?? [] : [],
)

const achievementAwardParticipants = computed(() => {
  const eventId = achievementAwardEventId.value ?? activeEventId.value
  return eventId ? eventParticipantsByEventId.value[eventId] ?? [] : []
})

const activeEventAwards = computed(() =>
  activeEventId.value ? eventAchievementAwardsByEventId.value[activeEventId.value] ?? [] : [],
)

const activeParticipantAchievementIds = computed(() => {
  const event = activeEvent.value
  const participantId = currentParticipant.value?.id
  if (!event || !participantId) return new Set<string>()

  const ids = new Set<string>()
  for (const achievement of event.achievements) {
    if (getAwardsForAchievement(event, achievement).some((award) => award.participantId === participantId)) {
      ids.add(achievement.id)
    }
  }
  return ids
})

function getAssetById(list: AssetOption[], id: string) {
  return list.find((item) => item.id === id) ?? null
}

const selectedCoverAsset = computed(() =>
  createEventForm.value.uploadedCoverUrl
    ? {
        id: 'uploaded-cover',
        kind: 'image' as const,
        label: 'Своя обложка',
        src: createEventForm.value.uploadedCoverUrl,
      }
    : getAssetById(coverAssetOptions, createEventForm.value.coverAssetId),
)

const selectedBackgroundAsset = computed<AssetOption | null>(() => {
  if (createEventForm.value.backgroundMode !== 'asset') {
    return null
  }

  if (createEventForm.value.uploadedBackgroundUrl) {
    const uploadedKind: AssetOption['kind'] =
      createEventForm.value.backgroundMediaType === 'video' ? 'video' : 'image'
    const uploadedCategory: AssetOption['category'] =
      createEventForm.value.backgroundMediaType === 'gif' ? 'gif' : 'poster'

    return {
      id: 'uploaded-background',
      kind: uploadedKind,
      category: uploadedCategory,
      label: 'Свой фон',
      src: createEventForm.value.uploadedBackgroundUrl,
    }
  }

  return getAssetById(backgroundAssetOptions, createEventForm.value.backgroundAssetId)
})

const createResolvedTextTheme = computed(() => resolveEventTextTheme(getEventTextThemeSourceFromForm()))

const selectedAutomaticTemplates = computed(() =>
  achievementTemplates.value.filter(
    (template) =>
      template.scope === 'automatic' &&
      isSupportedAutomaticTemplateId(template.id) &&
      createEventForm.value.automaticTemplateIds.includes(template.id),
  ),
)

const selectedPersonalTemplates = computed(() =>
  achievementTemplates.value.filter(
    (template) =>
      template.scope === 'personal' &&
      createEventForm.value.selectedPersonalTemplateIds.includes(template.id),
  ),
)

const selectedGroupTemplates = computed(() =>
  achievementTemplates.value.filter(
    (template) =>
      template.scope === 'group' &&
      createEventForm.value.selectedGroupTemplateIds.includes(template.id),
  ),
)

const availableAutomaticTemplates = computed(() =>
  achievementTemplates.value.filter(
    (template) =>
      template.scope === 'automatic' &&
      isSupportedAutomaticTemplateId(template.id) &&
      !createEventForm.value.automaticTemplateIds.includes(template.id),
  ),
)

const availablePersonalTemplates = computed(() =>
  achievementTemplates.value.filter(
    (template) =>
      template.scope === 'personal' &&
      !createEventForm.value.selectedPersonalTemplateIds.includes(template.id),
  ),
)

const availableGroupTemplates = computed(() =>
  achievementTemplates.value.filter(
    (template) =>
      template.scope === 'group' &&
      !createEventForm.value.selectedGroupTemplateIds.includes(template.id),
  ),
)

const previewAchievements = computed(() => [
  ...selectedAutomaticTemplates.value,
  ...selectedPersonalTemplates.value,
  ...selectedGroupTemplates.value,
])

const filteredCoverAssets = computed(() => {
  const normalizedQuery = coverSearchQuery.value.trim().toLowerCase()
  if (!normalizedQuery) return coverAssetOptions
  return coverAssetOptions.filter((asset) => asset.label.toLowerCase().includes(normalizedQuery))
})

const filteredCoverPosters = computed(() =>
  filteredCoverAssets.value.filter((asset) => asset.category !== 'gif'),
)

const filteredCoverGifs = computed(() =>
  filteredCoverAssets.value.filter((asset) => asset.category === 'gif'),
)

const activeCoverPickerAssets = computed(() =>
  coverPickerTab.value === 'gifs' ? filteredCoverGifs.value : filteredCoverPosters.value,
)

const createBackgroundStyle = computed(() => {
  if (createEventForm.value.backgroundMode === 'color') {
    return { background: createEventForm.value.backgroundColor }
  }

  if (selectedBackgroundAsset.value && selectedBackgroundAsset.value.kind !== 'video') {
    return {
      background: `url("${selectedBackgroundAsset.value.src}") center / cover no-repeat`,
    }
  }

  return { background: '#f3f0ff' }
})

const previewBackgroundStyle = computed(() => {
  if (createEventForm.value.backgroundMode === 'color') {
    return { background: createEventForm.value.backgroundColor }
  }

  if (selectedBackgroundAsset.value && selectedBackgroundAsset.value.kind !== 'video') {
    return {
      background: `url("${selectedBackgroundAsset.value.src}") center / cover no-repeat`,
    }
  }

  return { background: '#f3f0ff' }
})

const selectedCountBySection = computed(() => ({
  automatic: selectedAutomaticTemplates.value.length,
  personal: selectedPersonalTemplates.value.length,
  group: selectedGroupTemplates.value.length,
}))

const activePhotoEntry = computed(() => {
  if (!selectedPhoto.value) return null

  return flatPhotos.value.find(
    (entry) =>
      entry.event.id === selectedPhoto.value?.eventId &&
      entry.photo.id === selectedPhoto.value?.photoId,
  )
})

function handlePhotoViewerKeydown(event: KeyboardEvent) {
  if (!selectedPhoto.value) return

  if (event.key === 'ArrowLeft') {
    event.preventDefault()
    stepPhoto(-1)
    return
  }

  if (event.key === 'ArrowRight') {
    event.preventDefault()
    stepPhoto(1)
    return
  }

  if (event.key === 'Escape') {
    event.preventDefault()
    closePhoto()
  }
}

watch(selectedPhoto, (value) => {
  if (value) {
    window.addEventListener('keydown', handlePhotoViewerKeydown)
    return
  }

  window.removeEventListener('keydown', handlePhotoViewerKeydown)
  clearViewerEventBackground()
})

watch(
  () =>
    activePhotoEntry.value
      ? `${activePhotoEntry.value.event.id}:${activePhotoEntry.value.event.backgroundStart}`
      : '',
  () => {
    void syncViewerEventBackground()
  },
)

onUnmounted(() => {
  window.removeEventListener('keydown', handlePhotoViewerKeydown)
  detachCreateAchievementPopoverListeners()
  clearViewerEventBackground()
  revokeProfileAvatarPreview()
  if (eventGuestSyncTimer) {
    clearInterval(eventGuestSyncTimer)
    eventGuestSyncTimer = null
  }
})

function dismissGuestPersistBanner() {
  guestPersistBannerDismissed.value = true
  if (typeof window !== 'undefined') {
    window.sessionStorage.setItem('event-gallery:guest-banner-dismissed', '1')
  }
}

function openGuestProfileUpgrade() {
  profileMenuOpen.value = false
  openAuth('profile')
}

function openAuth(mode: AuthMode) {
  authMode.value = mode
  authGuestName.value =
    hasRealAuthenticatedUser() && currentUser.mode === 'guest' ? currentUser.name : ''
  authEmail.value = currentUser.mode === 'profile' ? currentUser.email ?? '' : ''
  authCode.value = ''
  authEmailCodeRequested.value = false
  authEmailDelivery.value = null
  authError.value = ''
  authOpen.value = true
}

async function requestAuthCode() {
  authError.value = ''

  try {
    authEmailDelivery.value = await authService.requestEmailCode(authEmail.value)
    authEmailCodeRequested.value = true
  } catch (error) {
    authEmailDelivery.value = null
    authError.value = error instanceof Error ? error.message : 'Не удалось подготовить код.'
  }
}

// --- Авторизация: гость, email+код, миграция данных гостя в профиль ---
async function completeAuth() {
  authError.value = ''

  try {
    let nextUser: CurrentUser

    if (authMode.value === 'guest') {
      const guestName = clampTextLength(authGuestName.value, USER_NAME_MAX_LENGTH)
      if (guestName && !isValidUserName(guestName)) {
        authError.value = `Имя должно быть от 1 до ${USER_NAME_MAX_LENGTH} символов.`
        return
      }

      nextUser = await authService.createGuestUser(guestName)
    } else {
      if (!authEmailCodeRequested.value) {
        authError.value = 'Сначала нажмите «Получить код» и дождитесь письма.'
        return
      }

      const trimmedCode = authCode.value.trim()
      if (!trimmedCode) {
        authError.value = 'Введите код подтверждения.'
        return
      }

      nextUser =
        currentUser.mode === 'guest' || currentUser.mode === 'demo'
          ? await authService.upgradeGuestToProfile(authEmail.value, trimmedCode)
          : await authService.verifyEmailCode(authEmail.value, trimmedCode)
    }

    applyCurrentUser(nextUser)
    await loadHomeEvents()
    await syncAllEventPhotosFromService()
    await syncAllEventRsvpsFromService()
    await syncAllEventMessagesFromService()
    await syncAllEventAchievementsFromService()
    await syncAllEventAchievementAwardsFromService()
    authOpen.value = false
    profileMenuOpen.value = false
    notificationsOpen.value = false
    await resolveInviteFlow()
    if (currentView.value !== 'event') {
      currentView.value = 'home'
    }
  } catch (error) {
    authError.value = error instanceof Error ? error.message : 'Не удалось выполнить вход.'
    const restoredUser = await authService.getCurrentUser()
    if (restoredUser) {
      applyCurrentUser(restoredUser)
    }
  }
}

async function logout() {
  await authService.logout()
  applyCurrentUser(createAnonymousUserPlaceholder())
  homeEvents.value = []
  currentParticipant.value = null
  guestPersistBannerDismissed.value = false
  if (typeof window !== 'undefined') {
    window.sessionStorage.removeItem('event-gallery:guest-banner-dismissed')
  }
  currentView.value = 'home'
  profileMenuOpen.value = false
  notificationsOpen.value = false
  selectedPhoto.value = null
  createEventOpen.value = false
  medalBuilderOpen.value = false
  activeEventId.value = null
  previewDraftEvent.value = null
  coverPickerOpen.value = false
  closeCreateAchievementPopover()
  authCode.value = ''
  authEmail.value = ''
  authGuestName.value = ''
  authEmailCodeRequested.value = false
  authEmailDelivery.value = null
  authError.value = ''
  resetInviteFlowState()
  inviteLinkStatus.value = ''
  clearEventNavigationFromUrl()
}

function toggleProfileMenu() {
  profileMenuOpen.value = !profileMenuOpen.value
}

function revokeProfileAvatarPreview() {
  if (profileAvatarPreviewObjectUrl) {
    URL.revokeObjectURL(profileAvatarPreviewObjectUrl)
    profileAvatarPreviewObjectUrl = null
  }
}

function openProfileEditor(focus: 'name' | 'avatar' = 'name') {
  profileEditorName.value = currentUser.displayName?.trim() || ''
  revokeProfileAvatarPreview()
  profileEditorAvatarFile.value = null
  profileEditorAvatarPreviewUrl.value = getCurrentUserAvatarUrlForDocuments() ?? null
  profileEditorError.value = ''
  profileEditorOpen.value = true
  profileMenuOpen.value = false

  if (profileAvatarInput.value) {
    profileAvatarInput.value.value = ''
  }

  if (focus === 'avatar') {
    void nextTick(() => triggerProfileAvatarPicker())
  }
}

function triggerProfileAvatarPicker() {
  profileAvatarInput.value?.click()
}

function closeProfileEditor() {
  profileEditorOpen.value = false
  profileEditorError.value = ''
  profileEditorName.value = ''
  revokeProfileAvatarPreview()
  profileEditorAvatarFile.value = null
  profileEditorAvatarPreviewUrl.value = null
  if (profileAvatarInput.value) {
    profileAvatarInput.value.value = ''
  }
}

function clearPendingEventVisualFiles() {
  uploadedCoverFile.value = null
  uploadedBackgroundFile.value = null
}

async function handleProfileAvatarUpload(nativeEvent: Event) {
  const input = nativeEvent.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  const allowedTypes = [
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
    'image/avif',
    'image/jfif',
  ]
  if (!allowedTypes.includes(file.type)) {
    profileEditorError.value = 'Поддерживаются PNG, JPEG, WEBP, GIF, AVIF и JFIF.'
    input.value = ''
    return
  }

  const maxBytes = isAppwriteMode() ? 3 * 1024 * 1024 : 2 * 1024 * 1024
  if (file.size > maxBytes) {
    profileEditorError.value = `Файл аватара должен быть не больше ${isAppwriteMode() ? 3 : 2} МБ.`
    input.value = ''
    return
  }

  try {
    revokeProfileAvatarPreview()
    profileEditorAvatarFile.value = file
    profileAvatarPreviewObjectUrl = URL.createObjectURL(file)
    profileEditorAvatarPreviewUrl.value = profileAvatarPreviewObjectUrl
    profileEditorError.value = ''
  } catch (error) {
    profileEditorError.value =
      error instanceof Error ? error.message : 'Не удалось загрузить изображение.'
  } finally {
    input.value = ''
  }
}

async function syncParticipantProfileAfterProfileChange(nextUser: CurrentUser) {
  const nextName = nextUser.displayName?.trim() || 'Гость'
  const updatedParticipations = await participantService.syncUserProfileToParticipations(nextUser.id, {
    displayName: nextName,
    avatarUrl: nextUser.avatarUrl,
    avatarFileId: nextUser.avatarFileId,
  })

  if (updatedParticipations.length === 0) {
    return
  }

  const participationsByEventId = new Map(updatedParticipations.map((participant) => [participant.eventId, participant]))
  const nextParticipantsByEventId = { ...eventParticipantsByEventId.value }

  for (const participant of updatedParticipations) {
    const existing = nextParticipantsByEventId[participant.eventId] ?? []
    nextParticipantsByEventId[participant.eventId] = existing.some((item) => item.id === participant.id)
      ? existing.map((item) => (item.id === participant.id ? participant : item))
      : [...existing, participant]
  }

  eventParticipantsByEventId.value = nextParticipantsByEventId

  if (currentParticipant.value) {
    const currentMatch = updatedParticipations.find((participant) => participant.id === currentParticipant.value?.id)
    if (currentMatch) {
      currentParticipant.value = currentMatch
    }
  }

  homeEvents.value = homeEvents.value.map((event) => {
    const organizerParticipant = participationsByEventId.get(event.id)
    const isOrganizerEvent =
      event.organizerId === nextUser.id ||
      Boolean(event.organizerId && isMergedGuestUserId(event.organizerId)) ||
      organizerParticipant?.role === 'organizer'

    if (!isOrganizerEvent || !organizerParticipant) return event
    return applyOrganizerAvatarToEvent(event, organizerParticipant)
  })

  for (const event of homeEvents.value) {
    if (
      event.organizerId === nextUser.id ||
      Boolean(event.organizerId && isMergedGuestUserId(event.organizerId))
    ) {
      eventService.cacheEventState(event)
    }
  }
}

async function saveProfileEditor() {
  profileEditorError.value = ''

  try {
    const storedUser = await authService.getCurrentUser()
    let avatarUrl = currentUser.avatarStorageRef ?? storedUser?.avatarUrl
    let avatarFileId = currentUser.avatarFileId

    if (profileEditorAvatarFile.value) {
      if (isAppwriteMode()) {
        const uploadedAvatar = await storageService.uploadUserAvatar(profileEditorAvatarFile.value)
        avatarUrl = uploadedAvatar.previewUrl
        avatarFileId = uploadedAvatar.fileId
      } else {
        avatarUrl = await replaceLocalImageFile(
          profileEditorAvatarFile.value,
          `avatar:${currentUser.id}`,
          {
            maxDimension: 512,
            quality: 0.86,
          },
          avatarUrl,
        )
      }
    } else if (profileEditorAvatarPreviewUrl.value) {
      avatarUrl = isAppwriteMode()
        ? sanitizePersistableUrl(profileEditorAvatarPreviewUrl.value) || avatarUrl
        : isLocalBlobRef(profileEditorAvatarPreviewUrl.value)
          ? profileEditorAvatarPreviewUrl.value
          : avatarUrl
    }

    const displayName = clampTextLength(profileEditorName.value, USER_NAME_MAX_LENGTH)
    if (!isValidUserName(displayName)) {
      profileEditorError.value = `Имя должно быть от 1 до ${USER_NAME_MAX_LENGTH} символов.`
      return
    }

    const nextUser = await authService.updateCurrentUserProfile({
      displayName,
      avatarUrl,
      avatarFileId,
    })
    applyCurrentUser(nextUser)
    await refreshCurrentUserAvatarDisplay(nextUser.avatarUrl, nextUser.avatarFileId)
    await syncParticipantProfileAfterProfileChange(nextUser)
    await chatService.syncAuthorProfileForUser(nextUser.id, {
      displayName: nextUser.displayName?.trim() || 'Гость',
      avatarUrl: nextUser.avatarUrl,
      avatarFileId: nextUser.avatarFileId,
    })
    await rsvpService.syncUserRsvpProfile(nextUser.id, {
      displayName: nextUser.displayName?.trim() || 'Гость',
      avatarUrl: nextUser.avatarUrl,
      avatarFileId: nextUser.avatarFileId,
    })
    await syncAllEventParticipantsFromService()
    homeEvents.value = await eventService.getHomeEvents()
    if (activeEventId.value) {
      await refreshEventDataFromServices(activeEventId.value)
    }
    closeProfileEditor()
  } catch (error) {
    profileEditorError.value =
      error instanceof Error ? error.message : 'Не удалось сохранить профиль.'
  }
}

// --- Создание и редактирование события (форма + превью + загрузка обложек) ---
function openCreateEvent() {
  if (!hasRealAuthenticatedUser()) {
    openAuth('guest')
    return
  }

  resetCreateEventForm()
  clearPendingEventVisualFiles()
  medalForm.value = createEmptyMedalForm()
  applyBackgroundColor(createEventForm.value.backgroundColor)
  enforceCreateDateTimeRules()
  createEventForm.value.automaticExpanded = false
  createEventForm.value.personalExpanded = false
  createEventForm.value.groupExpanded = false
  currentView.value = 'create'
  createEventOpen.value = true
  medalBuilderOpen.value = false
  activeEventId.value = null
  previewDraftEvent.value = null
  coverPickerOpen.value = false
  coverPickerTab.value = 'posters'
  coverSearchQuery.value = ''
  emojiPickerOpen.value = false
  closeCreateAchievementPopover()
  notificationsOpen.value = false
  profileMenuOpen.value = false
  inviteLinkStatus.value = ''
  clearEventNavigationFromUrl()
}

async function closeCreateEvent() {
  const eventIdBeingEdited = editingEventId.value

  createEventOpen.value = false
  clearPendingEventVisualFiles()
  medalBuilderOpen.value = false
  previewDraftEvent.value = null
  editingEventId.value = null
  coverPickerOpen.value = false
  closeCreateAchievementPopover()
  resetCreateEventForm()

  if (eventIdBeingEdited) {
    await openEventPage(eventIdBeingEdited)
    return
  }

  currentView.value = 'home'
  activeEventId.value = null
}

function openGuestPreview() {
  enforceCreateDateTimeRules()
  const draft = createEventFromForm()
  draft.title = draft.title || 'Untitled Event'
  previewDraftEvent.value = draft
  currentView.value = 'preview'
  medalBuilderOpen.value = false
  coverPickerOpen.value = false
}

function closeGuestPreview() {
  currentView.value = 'create'
  previewDraftEvent.value = null
}

// --- Страница события: синхронизация данных, URL, фон просмотрщика ---
async function openEventPage(eventId: string, eventOverride?: GalleryEvent | null) {
  if (eventOverride) {
    upsertHomeEvent(eventOverride)
  }

  const freshEvent = await eventService.getEventById(eventId)
  const existingEvent = getEventById(eventId) ?? eventOverride
  if (freshEvent) {
    upsertHomeEvent(existingEvent ? mergeEventMetadata(existingEvent, freshEvent) : freshEvent)
  }

  const event = getEventById(eventId) ?? eventOverride
  syncEventUrlForActiveEvent(event)
  activeEventId.value = eventId
  achievementsPanelOpen.value = false
  openEventAchievementId.value = null
  currentView.value = 'event'
  await refreshEventDataFromServices(eventId)
  syncEventUrlForActiveEvent(getEventById(eventId) ?? eventOverride)
  eventChatDraft.value = ''
  profileMenuOpen.value = false
  notificationsOpen.value = false
  selectedPhoto.value = null
  inviteLinkStatus.value = ''
  closeRsvpSheet()
}

function closeEventPage() {
  currentView.value = 'home'
  activeEventId.value = null
  achievementsPanelOpen.value = false
  openEventAchievementId.value = null
  eventChatDraft.value = ''
  pendingInviteEventId.value = null
  inviteLinkStatus.value = ''
  clearEventNavigationFromUrl()
  closeRsvpSheet()
}

function removeInfoBlock(blockId: string) {
  createEventForm.value.infoBlocks = createEventForm.value.infoBlocks.filter(
    (block) => block.id !== blockId,
  )
}

function openMedalBuilder(scope: Extract<AchievementScope, 'personal' | 'group'>) {
  medalForm.value = createEmptyMedalForm()
  medalForm.value.scope = scope
  emojiPickerOpen.value = false
  medalBuilderOpen.value = true
}

watch(coverPickerOpen, (isOpen) => {
  if (isOpen) {
    coverPickerTab.value = 'posters'
  }
})

watch(medalBuilderOpen, (isOpen) => {
  if (!isOpen) {
    emojiPickerOpen.value = false
  }
})

watch(
  [activeEvent, () => currentUser.id, () => currentUser.displayName, currentView],
  async ([event, userId, , view]) => {
    if (view !== 'event' || !event || !userId) {
      currentParticipant.value = null
      return
    }

    await ensureCurrentParticipant(event)
  },
  { immediate: true },
)

watch([currentView, activeEventId], ([view, eventId]) => {
  if (eventGuestSyncTimer) {
    clearInterval(eventGuestSyncTimer)
    eventGuestSyncTimer = null
  }

  highlightedGuestRsvpId.value = null

  if (view !== 'event' || !eventId) {
    return
  }

  const syncGuestData = () => {
    void syncEventGuestDataFromService(eventId)
  }

  void syncGuestData()
  eventGuestSyncTimer = setInterval(syncGuestData, 8000)
})

// --- Достижения: шаблоны, выдача, автоматические награды ---
async function saveCustomMedal() {
  const trimmedTitle = medalForm.value.title.trim()
  const trimmedDescription = medalForm.value.description.trim()
  if (!trimmedTitle || !trimmedDescription) return

  const newTemplate = await achievementService.createAchievementTemplate({
    scope: medalForm.value.scope,
    title: trimmedTitle,
    description: trimmedDescription,
    icon: medalForm.value.icon.trim() || '🏅',
    tone: medalForm.value.tone,
    visibility: medalForm.value.visibility,
    createdBy: currentUser.id,
  })

  await loadAchievementTemplates()
  if (newTemplate.scope === 'group') {
    createEventForm.value.selectedGroupTemplateIds = [
      ...createEventForm.value.selectedGroupTemplateIds,
      newTemplate.id,
    ]
  } else {
    createEventForm.value.selectedPersonalTemplateIds = [
      ...createEventForm.value.selectedPersonalTemplateIds,
      newTemplate.id,
    ]
  }
  createEventForm.value.templateVisibility = {
    ...createEventForm.value.templateVisibility,
    [newTemplate.id]: newTemplate.visibility ?? 'visible',
  }

  medalBuilderOpen.value = false
}

function setActiveTab(tab: EventTab) {
  activeTab.value = tab
  activeAchievement.value = null
}

function isEventExpanded(id: string) {
  return expandedEvents.value.has(id)
}

function toggleEventExpanded(id: string) {
  const event = homeEvents.value.find((item) => item.id === id)
  if (!event || !canExpandOnHome(event)) return

  const next = new Set(expandedEvents.value)
  if (next.has(id)) {
    next.delete(id)
    activeAchievement.value = null
  } else {
    next.add(id)
  }
  expandedEvents.value = next
}

function toggleAllEvents() {
  const next = new Set(expandedEvents.value)
  if (allVisibleExpanded.value) {
    expandableVisibleEvents.value.forEach((event) => next.delete(event.id))
    activeAchievement.value = null
  } else {
    expandableVisibleEvents.value.forEach((event) => next.add(event.id))
  }
  expandedEvents.value = next
}

function getEventById(eventId: string) {
  return homeEvents.value.find((event) => event.id === eventId) ?? null
}

function getAchievementConfigKey(achievement: Pick<EventAchievement, 'id' | 'templateId'>) {
  return achievement.templateId ?? achievement.id
}

function getAwardsForAchievement(event: GalleryEvent, achievement: EventAchievement) {
  const configKey = getAchievementConfigKey(achievement)

  return getEventAwards(event.id).filter((award) => {
    if (award.achievementId === achievement.id) {
      return true
    }

    const awardedAchievement = event.achievements.find((item) => item.id === award.achievementId)
    if (!awardedAchievement) {
      return false
    }

    return getAchievementConfigKey(awardedAchievement) === configKey
  })
}

function normalizeParticipantAwards(event: GalleryEvent, awards: ParticipantAchievement[]) {
  const deduped = new Map<string, ParticipantAchievement>()

  for (const award of awards) {
    const achievement =
      event.achievements.find((item) => item.id === award.achievementId) ??
      event.achievements.find((item) => getAchievementConfigKey(item) === award.achievementId)

    if (!achievement) {
      continue
    }

    const key = `${award.participantId}:${achievement.id}`
    if (!deduped.has(key)) {
      deduped.set(key, {
        ...award,
        achievementId: achievement.id,
      })
    }
  }

  return [...deduped.values()]
}

async function cleanupOrphanAchievementAwards(eventId: string, event: GalleryEvent, awards: ParticipantAchievement[]) {
  const normalized = normalizeParticipantAwards(event, awards)
  const orphans = awards.filter(
    (award) => !normalized.some((item) => item.id === award.id),
  )

  if (!orphans.length) {
    return
  }

  await Promise.all(
    orphans.map((award) =>
      achievementService.revokeAchievement({
        eventId,
        achievementId: award.achievementId,
        participantId: award.participantId,
      }),
    ),
  )
}

async function refreshEventDataFromServices(eventId: string) {
  let event = getEventById(eventId)
  if (!event) {
    const loadedEvent = await eventService.getEventById(eventId)
    if (!loadedEvent) {
      return null
    }
    upsertHomeEvent(loadedEvent)
    event = loadedEvent
  }

  const [photos, guestRsvps, chatMessages, achievements, participants, awards] = await Promise.all([
    photoService.getEventPhotos(eventId, currentUser.id),
    rsvpService.getEventRsvps(eventId),
    chatService.getEventMessages(eventId),
    achievementService.getEventAchievements(eventId),
    participantService.getEventParticipants(eventId),
    achievementService.getEventAchievementAwards(eventId),
  ])

  eventParticipantsByEventId.value = {
    ...eventParticipantsByEventId.value,
    [eventId]: participants,
  }

  const normalizedAwards = normalizeParticipantAwards(
    {
      ...event,
      achievements,
    },
    awards,
  )

  await cleanupOrphanAchievementAwards(
    eventId,
    {
      ...event,
      achievements,
    },
    awards,
  )

  eventAchievementAwardsByEventId.value = {
    ...eventAchievementAwardsByEventId.value,
    [eventId]: normalizedAwards,
  }

  const eventSnapshot = {
    ...event,
    photos,
    guestRsvps,
    chatMessages,
    achievements,
  }

  const awardsChanged = await processAutomaticAchievementsForEvent({
    event: eventSnapshot,
    photos,
    achievements,
    participants,
    awards: normalizedAwards,
    awardedByUserId: event.organizerId || currentUser.id,
  })

  let nextAwards = normalizedAwards
  if (awardsChanged) {
    const freshAwards = await achievementService.getEventAchievementAwards(eventId)
    nextAwards = normalizeParticipantAwards(eventSnapshot, freshAwards)
    await cleanupOrphanAchievementAwards(eventId, eventSnapshot, freshAwards)
    eventAchievementAwardsByEventId.value = {
      ...eventAchievementAwardsByEventId.value,
      [eventId]: nextAwards,
    }
  }

  return replaceHomeEvent(eventSnapshot)
}

// --- Старт приложения и deep-link по invite / eventId ---
const inviteFlow = useInviteFlow({
  currentView,
  activeTab,
  authMode,
  authGuestName,
  authError,
  authOpen,
  hasRealAuthenticatedUser,
  isAppwriteMode,
  getEventById,
  upsertHomeEvent,
  openEventPage,
  ensureCurrentParticipant,
  loadHomeEvents,
  refreshEventDataFromServices,
})

const {
  pendingInviteCode,
  pendingInviteEventId,
  inviteErrorMessage,
  resolveInviteFlow,
  restoreEventPageFromUrl,
  resetInviteFlowState,
} = inviteFlow

function syncEventUrlForActiveEvent(event: GalleryEvent | null | undefined) {
  syncEventUrlInLocation(event, {
    isOrganizer: event ? isCurrentUserOrganizer(event) : false,
    inviteCodeFallback: pendingInviteCode.value,
  })
}

async function initializeApp() {
  appInitializing.value = true

  try {
    if (!isAppwriteMode()) {
      await photoService.migrateLocalStorageMedia()
    }

    const storedUser = await authService.getCurrentUser()
    let activeUser: CurrentUser | null = storedUser

    if (!activeUser && !isAppwriteMode()) {
      activeUser = await authService.createDemoUser()
    }

    if (activeUser) {
      applyCurrentUser(activeUser)
      await loadInitialAppData()
    } else {
      applyCurrentUser(createAnonymousUserPlaceholder())
    }

    if (readInviteCodeFromLocation()) {
      await resolveInviteFlow()
    } else if (readEventIdFromLocation()) {
      await restoreEventPageFromUrl()
    } else if (currentView.value !== 'event') {
      currentView.value = 'home'
    }
  } catch (error) {
    console.error('[app] initialization failed', error)
    currentView.value = 'home'
  } finally {
    appInitializing.value = false
  }
}

void initializeApp()

async function syncEventPhotosFromService(eventId: string) {
  const event = getEventById(eventId)
  if (!event) return null

  const photos = await photoService.getEventPhotos(eventId, currentUser.id)
  const nextEvent = {
    ...event,
    photos,
  }
  return replaceHomeEvent(nextEvent)
}

async function syncAllEventPhotosFromService() {
  for (const event of homeEvents.value) {
    await syncEventPhotosFromService(event.id)
  }
}

async function syncEventRsvpsFromService(eventId: string) {
  const event = getEventById(eventId)
  if (!event) return null

  const guestRsvps = await rsvpService.getEventRsvps(eventId)
  const nextEvent = {
    ...event,
    guestRsvps,
  }
  return replaceHomeEvent(nextEvent)
}

async function syncEventGuestDataFromService(eventId: string) {
  const event = getEventById(eventId)
  if (!event) return null

  const [guestRsvps, participants, photos, achievements, awards] = await Promise.all([
    rsvpService.getEventRsvps(eventId),
    participantService.getEventParticipants(eventId),
    photoService.getEventPhotos(eventId, currentUser.id),
    achievementService.getEventAchievements(eventId),
    achievementService.getEventAchievementAwards(eventId),
  ])

  eventParticipantsByEventId.value = {
    ...eventParticipantsByEventId.value,
    [eventId]: participants,
  }

  const eventSnapshot = {
    ...event,
    photos,
    guestRsvps,
    achievements,
  }
  const normalizedAwards = normalizeParticipantAwards(eventSnapshot, awards)

  const awardsChanged = await processAutomaticAchievementsForEvent({
    event: eventSnapshot,
    photos,
    achievements,
    participants,
    awards: normalizedAwards,
    awardedByUserId: event.organizerId || currentUser.id,
  })

  if (awardsChanged) {
    await syncEventAchievementAwardsFromService(eventId)
  }

  return replaceHomeEvent({
    ...event,
    guestRsvps,
    photos,
    achievements,
  })
}

async function syncAllEventRsvpsFromService() {
  for (const event of homeEvents.value) {
    await syncEventRsvpsFromService(event.id)
  }
}

async function syncEventMessagesFromService(eventId: string) {
  const event = getEventById(eventId)
  if (!event) return null

  const chatMessages = await chatService.getEventMessages(eventId)
  const nextEvent = {
    ...event,
    chatMessages,
  }
  return replaceHomeEvent(nextEvent)
}

async function syncAllEventMessagesFromService() {
  for (const event of homeEvents.value) {
    await syncEventMessagesFromService(event.id)
  }
}

async function syncEventAchievementsFromService(eventId: string) {
  const event = getEventById(eventId)
  if (!event) return null

  const achievements = await achievementService.getEventAchievements(eventId)
  const nextEvent = {
    ...event,
    achievements,
  }
  return replaceHomeEvent(nextEvent)
}

async function syncAllEventAchievementsFromService() {
  for (const event of homeEvents.value) {
    await syncEventAchievementsFromService(event.id)
  }
}

async function syncEventParticipantsFromService(eventId: string) {
  const participants = await participantService.getEventParticipants(eventId)

  if (!isAppwriteMode()) {
    await Promise.all(
      participants.map(async (participant) => {
        if (isLocalBlobRef(participant.avatarUrl)) {
          await resolveLocalBlobUrl(participant.avatarUrl)
        }
      }),
    )
  }

  eventParticipantsByEventId.value = {
    ...eventParticipantsByEventId.value,
    [eventId]: participants,
  }
  return eventParticipantsByEventId.value[eventId]
}

async function syncAllEventParticipantsFromService() {
  for (const event of homeEvents.value) {
    await syncEventParticipantsFromService(event.id)
  }
}

async function syncEventAchievementAwardsFromService(eventId: string) {
  const event = getEventById(eventId)
  const awards = await achievementService.getEventAchievementAwards(eventId)

  if (!event) {
    eventAchievementAwardsByEventId.value = {
      ...eventAchievementAwardsByEventId.value,
      [eventId]: awards,
    }
    return awards
  }

  const normalizedAwards = normalizeParticipantAwards(event, awards)
  await cleanupOrphanAchievementAwards(eventId, event, awards)

  eventAchievementAwardsByEventId.value = {
    ...eventAchievementAwardsByEventId.value,
    [eventId]: normalizedAwards,
  }
  return normalizedAwards
}

async function syncAllEventAchievementAwardsFromService() {
  for (const event of homeEvents.value) {
    await syncEventAchievementAwardsFromService(event.id)
  }
}

function getEventAchievementConfigKey(achievement: EventAchievement) {
  return (
    achievement.templateId ??
    achievementTemplates.value.find((template) => template.title === achievement.title)?.id ??
    achievement.id
  )
}

async function persistEventAchievementsSelection(eventId: string) {
  const existingAchievements = await achievementService.getEventAchievements(eventId)
  const desiredConfigs = [
    ...selectedAutomaticTemplates.value.map((template) => ({ template, scope: 'automatic' as const })),
    ...selectedPersonalTemplates.value.map((template) => ({ template, scope: 'personal' as const })),
    ...selectedGroupTemplates.value.map((template) => ({ template, scope: 'group' as const })),
  ]
  const desiredTemplateIds = new Set(desiredConfigs.map(({ template }) => template.id))

  for (const achievement of existingAchievements) {
    if (!desiredTemplateIds.has(getEventAchievementConfigKey(achievement))) {
      await achievementService.unselectAchievement(achievement.id)
    }
  }

  for (const { template, scope } of desiredConfigs) {
    await achievementService.selectAchievement({
      eventId,
      templateId: template.id,
      scope,
      title: template.title,
      description: template.description,
      icon: template.icon,
      tone: template.tone,
      visibility: getTemplateVisibility(template.id),
      points: template.points,
      createdBy: currentUser.id,
    })
  }

  return refreshEventDataFromServices(eventId)
}

function buildSavedEventFromExisting(existing: GalleryEvent, updated: GalleryEvent) {
  return {
    ...existing,
    ...updated,
    photos: existing.photos,
    chatMessages: existing.chatMessages,
    guestRsvps: existing.guestRsvps,
    savedCount: existing.savedCount,
    achievements: existing.achievements,
    role: existing.role,
  }
}

async function completeEventEditorTransition(event: GalleryEvent, notice: { title: string; text: string }) {
  replaceHomeEvent(event)
  activeTab.value = event.status
  editingEventId.value = null
  createEventOpen.value = false
  clearPendingEventVisualFiles()
  medalBuilderOpen.value = false
  coverPickerOpen.value = false
  previewDraftEvent.value = null
  await openEventPage(event.id, event)
  notifications.value = [
    {
      id: createId('notice'),
      title: notice.title,
      text: notice.text,
      time: 'сейчас',
    },
    ...notifications.value,
  ]
}

async function syncEventAfterSave(eventId: string, organizerName: string) {
  try {
    await participantService.joinEventAsParticipant(eventId, organizerName, 'organizer')
  } catch (error) {
    console.warn('[App] post-save participant sync failed', error)
  }

  try {
    await persistEventAchievementsSelection(eventId)
  } catch (error) {
    console.warn('[App] post-save achievements sync failed', error)
  }

  try {
    await loadHomeEvents()
    await refreshEventDataFromServices(eventId)
  } catch (error) {
    console.warn('[App] post-save refresh failed', error)
  }
}

async function updateEventInList(eventId: string, updater: (event: GalleryEvent) => GalleryEvent) {
  const event = getEventById(eventId)
  if (!event) return null

  const nextEvent = updater(event)
  eventService.cacheEventState(nextEvent)
  await loadHomeEvents()
  return nextEvent
}

function getPreferredParticipantDisplayName() {
  return currentUser.displayName?.trim() || currentUser.name || 'Гость'
}

function getCurrentParticipantRole(event: GalleryEvent) {
  const existingParticipation = (eventParticipantsByEventId.value[event.id] ?? []).find(
    (participant) => participant.userId === currentUser.id,
  )
  if (existingParticipation?.role === 'organizer') {
    return 'organizer'
  }

  return event.organizerId === currentUser.id ||
    Boolean(event.organizerId && isMergedGuestUserId(event.organizerId)) ||
    (!event.organizerId && event.role === 'Организатор' && event.organizerName === currentUser.name)
    ? 'organizer'
    : 'guest'
}

async function ensureCurrentParticipant(event: GalleryEvent | null) {
  if (!event || !currentUser.id || (isAppwriteMode() && !hasRealAuthenticatedUser())) {
    currentParticipant.value = null
    return null
  }

  // Участник (participant) — связь пользователя с событием; RSVP на неё не влияет.
  const participant = await participantService.joinEventAsParticipant(
    event.id,
    getPreferredParticipantDisplayName(),
    getCurrentParticipantRole(event),
  )

  currentParticipant.value = participant
  return participant
}

async function addCurrentParticipantPoints(points: number) {
  if (!currentParticipant.value || points === 0) return null

  const updatedParticipant = await participantService.addParticipantPoints(currentParticipant.value.id, points)
  currentParticipant.value = updatedParticipant
  return updatedParticipant
}

function getRsvpEntryDisplayName(entry: EventRsvpEntry, eventId?: string) {
  if (entry.userId && resolveCanonicalUserId(entry.userId, currentUser.id) === currentUser.id) {
    return currentUser.displayName?.trim() || currentUser.name
  }

  const participant = findParticipantForUser(eventId, entry.userId)
  if (participant?.displayName) {
    return participant.displayName
  }

  return entry.displayName || entry.userName || 'Гость'
}

function getRsvpEntryInitials(entry: EventRsvpEntry, eventId?: string) {
  return entry.userInitials || buildUserInitials(getRsvpEntryDisplayName(entry, eventId))
}

function getCurrentUserRsvpEntry(event: GalleryEvent | null | undefined) {
  if (!event) return null

  const participantId =
    currentParticipant.value?.eventId === event.id ? currentParticipant.value.id : undefined

  return (
    event.guestRsvps.find(
      (entry) =>
        (entry.userId && resolveCanonicalUserId(entry.userId, currentUser.id) === currentUser.id) ||
        (participantId && entry.participantId === participantId),
    ) ?? null
  )
}

function getCurrentUserRsvpStatus(event: GalleryEvent | null | undefined): RsvpStatus | null {
  return getCurrentUserRsvpEntry(event)?.status ?? null
}

function getGoingRsvpEntries(event: GalleryEvent) {
  return event.guestRsvps.filter((entry) => entry.status === 'going')
}

function getCurrentParticipantIdForEvent(event: GalleryEvent) {
  return currentParticipant.value?.eventId === event.id ? currentParticipant.value.id : undefined
}

function isGoingRsvpBlockedForEvent(event: GalleryEvent | null | undefined, status: RsvpStatus) {
  if (!event || status !== 'going') return false
  if (isCurrentUserOrganizer(event)) return false

  return !canSetGoingRsvp(event, {
    userId: currentUser.id,
    participantId: getCurrentParticipantIdForEvent(event),
  })
}

function notifyCapacityFull() {
  notifications.value = [
    {
      id: createId('notice'),
      title: 'Мест нет',
      text: EVENT_CAPACITY_FULL_MESSAGE,
      time: 'сейчас',
    },
    ...notifications.value,
  ]
}

function selectRsvpSheetStatus(status: RsvpStatus) {
  if (isGoingRsvpBlockedForEvent(activeEvent.value, status)) {
    notifyCapacityFull()
    return
  }

  rsvpSheetStatus.value = status
}

function toggleHighlightedGuest(rsvpId: string) {
  highlightedGuestRsvpId.value = highlightedGuestRsvpId.value === rsvpId ? null : rsvpId
}

const highlightedGuestRsvpEntry = computed(() => {
  if (!highlightedGuestRsvpId.value || !eventPageData.value) return null
  return (
    eventPageData.value.guestRsvps.find((entry) => entry.id === highlightedGuestRsvpId.value) ?? null
  )
})

function getMessageAuthorName(message: EventChatMessage, eventId?: string) {
  if (message.userId && resolveCanonicalUserId(message.userId, currentUser.id) === currentUser.id) {
    return currentUser.displayName?.trim() || currentUser.name
  }

  const participant = findParticipantForAuthor(eventId, message)
  if (participant?.displayName) {
    return participant.displayName
  }

  return message.authorName?.trim() || 'Участник'
}

function getMessageAuthorInitials(message: EventChatMessage, eventId?: string) {
  return buildUserInitials(getMessageAuthorName(message, eventId))
}

function isCurrentUserOrganizer(event: GalleryEvent | null) {
  if (!event) return false

  const participation = (eventParticipantsByEventId.value[event.id] ?? []).find(
    (participant) => participant.userId === currentUser.id,
  )

  return (
    currentParticipant.value?.role === 'organizer' ||
    participation?.role === 'organizer' ||
    event.organizerId === currentUser.id ||
    Boolean(event.organizerId && isMergedGuestUserId(event.organizerId)) ||
    (event.role === 'Организатор' && event.organizerName === currentUser.name)
  )
}

function canShowEventInvite(event: GalleryEvent | null | undefined) {
  if (!event) return false

  return Boolean(event.allowGuestInvites) || isCurrentUserOrganizer(event)
}

// --- Чат события и вложения-фото в сообщениях ---
async function sendEventChatMessage() {
  const event = activeEvent.value
  const text = eventChatDraft.value.trim()
  if (!event || !text) return

  const participant = currentParticipant.value ?? (await ensureCurrentParticipant(event))
  if (!participant) return

  const persistableAvatarUrl = await getPersistableAuthorAvatarUrl(participant)

  const nextMessage = await chatService.addEventMessage({
    eventId: event.id,
    userId: currentUser.id,
    participantId: participant.id,
    authorName: participant.displayName,
    authorAvatarUrl: persistableAvatarUrl,
    text,
  })

  await updateEventInList(event.id, (current) => ({
    ...current,
    chatMessages: [...current.chatMessages, nextMessage],
  }))
  await syncEventMessagesFromService(event.id)
  eventChatDraft.value = ''
}

async function togglePhotoSaved(eventId: string, photoId: string) {
  const event = getEventById(eventId)
  if (!event) return

  const participant =
    currentParticipant.value?.eventId === event.id
      ? currentParticipant.value
      : await ensureCurrentParticipant(event)
  const { saved } = await savedPhotoService.toggleSavedPhoto({
    userId: currentUser.id,
    eventId,
    photoId,
    participantId: participant?.id,
  })

  await updateEventInList(eventId, (current) => {
    const nextEvent = {
      ...current,
      photos: current.photos.map((photo) =>
        photo.id === photoId
          ? {
              ...photo,
              saved,
            }
          : photo,
      ),
    }
    syncEventSavedCount(nextEvent)
    return nextEvent
  })
}

function isPhotoSaved(eventId: string, photoId: string) {
  const photo = getEventById(eventId)?.photos.find((item) => item.id === photoId)
  return Boolean(photo?.saved)
}

function openPhoto(event: GalleryEvent, photo: GalleryPhoto, useAlbum = false) {
  photoViewerMode.value = useAlbum ? 'event-album' : 'home'
  selectedPhoto.value = { eventId: event.id, photoId: photo.id }
  void syncViewerEventBackground()
}

function clearViewerEventBackground() {
  if (viewerBackgroundObjectUrl) {
    URL.revokeObjectURL(viewerBackgroundObjectUrl)
    viewerBackgroundObjectUrl = null
  }

  viewerEventBackgroundImage.value = ''
  viewerEventBackgroundGradient.value = false
}

async function syncViewerEventBackground() {
  clearViewerEventBackground()

  const entry = activePhotoEntry.value
  if (!entry) return

  const event = entry.event

  if (isVideoBackground(event)) {
    try {
      const frameUrl = await captureVideoPosterFrame(event.backgroundStart)
      viewerEventBackgroundImage.value = frameUrl
      if (frameUrl.startsWith('blob:')) {
        viewerBackgroundObjectUrl = frameUrl
      }
    } catch {
      viewerEventBackgroundGradient.value = usesGradientEventBackground(event)
    }
    return
  }

  if (isAssetSource(event.backgroundStart) && !event.backgroundStart.startsWith('#')) {
    viewerEventBackgroundImage.value = event.backgroundStart
    return
  }

  viewerEventBackgroundGradient.value = true
}

function handlePhotoViewerBackdropClick(event: MouseEvent) {
  const target = event.target as HTMLElement
  if (target.closest('.viewer-image, .viewer-image-fallback, .viewer-meta, .viewer-save-button, .viewer-edge')) {
    return
  }

  closePhoto()
}

function closePhoto() {
  selectedPhoto.value = null
  photoViewerMode.value = 'home'
  clearViewerEventBackground()
}

function stepPhoto(direction: number) {
  if (!selectedPhoto.value || flatPhotos.value.length === 0) return

  const currentIndex = flatPhotos.value.findIndex(
    (entry) =>
      entry.event.id === selectedPhoto.value?.eventId &&
      entry.photo.id === selectedPhoto.value?.photoId,
  )
  const nextIndex = (currentIndex + direction + flatPhotos.value.length) % flatPhotos.value.length
  const next = flatPhotos.value[nextIndex]
  selectedPhoto.value = { eventId: next.event.id, photoId: next.photo.id }
}

function getAchievementKey(event: GalleryEvent, achievement: EventAchievement) {
  return `${event.id}-${achievement.id}`
}

function toggleAchievement(event: GalleryEvent, achievement: EventAchievement) {
  const key = getAchievementKey(event, achievement)
  activeAchievement.value = activeAchievement.value === key ? null : key
}

function getTemplateVisibility(templateId: string): AchievementVisibility {
  return createEventForm.value.templateVisibility[templateId] ?? 'visible'
}

function setTemplateVisibility(templateId: string, visibility: AchievementVisibility) {
  const nextVisibility = { ...createEventForm.value.templateVisibility }
  if (visibility === 'visible') {
    delete nextVisibility[templateId]
  } else {
    nextVisibility[templateId] = visibility
  }
  createEventForm.value.templateVisibility = nextVisibility
}

function toggleAutomaticTemplate(templateId: string) {
  const nextIds = new Set(createEventForm.value.automaticTemplateIds)
  if (nextIds.has(templateId)) {
    nextIds.delete(templateId)
    const nextVisibility = { ...createEventForm.value.templateVisibility }
    delete nextVisibility[templateId]
    createEventForm.value.templateVisibility = nextVisibility
  } else {
    nextIds.add(templateId)
  }
  createEventForm.value.automaticTemplateIds = [...nextIds]
}

function toggleManualTemplate(templateId: string, scope: AchievementScope) {
  const nextIds = new Set(
    scope === 'group'
      ? createEventForm.value.selectedGroupTemplateIds
      : createEventForm.value.selectedPersonalTemplateIds,
  )
  if (nextIds.has(templateId)) {
    nextIds.delete(templateId)
    const nextVisibility = { ...createEventForm.value.templateVisibility }
    delete nextVisibility[templateId]
    createEventForm.value.templateVisibility = nextVisibility
  } else {
    nextIds.add(templateId)
  }
  if (scope === 'group') {
    createEventForm.value.selectedGroupTemplateIds = [...nextIds]
  } else {
    createEventForm.value.selectedPersonalTemplateIds = [...nextIds]
  }
}

function removeSelectedAchievement(templateId: string, scope: 'automatic' | AchievementScope) {
  const nextVisibility = { ...createEventForm.value.templateVisibility }
  delete nextVisibility[templateId]
  createEventForm.value.templateVisibility = nextVisibility
  if (scope === 'automatic') {
    createEventForm.value.automaticTemplateIds = createEventForm.value.automaticTemplateIds.filter(
      (id) => id !== templateId,
    )
    return
  }

  if (scope === 'group') {
    createEventForm.value.selectedGroupTemplateIds = createEventForm.value.selectedGroupTemplateIds.filter(
      (id) => id !== templateId,
    )
    return
  }

  createEventForm.value.selectedPersonalTemplateIds = createEventForm.value.selectedPersonalTemplateIds.filter(
    (id) => id !== templateId,
  )
}

function closeCreateAchievementPopover() {
  createAchievementPopover.value = null
  createAchievementPopoverAnchor.value = null
}

function parseCreateAchievementPopoverKey(key: string) {
  const separatorIndex = key.indexOf('-')
  if (separatorIndex <= 0) {
    return null
  }

  return {
    scope: key.slice(0, separatorIndex),
    templateId: key.slice(separatorIndex + 1),
  }
}

function updateCreateAchievementPopoverPosition() {
  const key = createAchievementPopover.value
  if (!key) {
    return
  }

  const anchor = document.querySelector(`[data-achievement-popover-key="${key}"]`)
  if (anchor instanceof HTMLElement) {
    createAchievementPopoverAnchor.value = anchor.getBoundingClientRect()
  }
}

function attachCreateAchievementPopoverListeners() {
  if (createAchievementPopoverListenersAttached) {
    return
  }

  window.addEventListener('scroll', updateCreateAchievementPopoverPosition, true)
  window.addEventListener('resize', updateCreateAchievementPopoverPosition)
  window.addEventListener('pointerdown', handleCreateAchievementPopoverOutsideClick, true)
  createAchievementPopoverListenersAttached = true
}

function detachCreateAchievementPopoverListeners() {
  if (!createAchievementPopoverListenersAttached) {
    return
  }

  window.removeEventListener('scroll', updateCreateAchievementPopoverPosition, true)
  window.removeEventListener('resize', updateCreateAchievementPopoverPosition)
  window.removeEventListener('pointerdown', handleCreateAchievementPopoverOutsideClick, true)
  createAchievementPopoverListenersAttached = false
}

function handleCreateAchievementPopoverOutsideClick(event: PointerEvent) {
  if (!createAchievementPopover.value) {
    return
  }

  const target = event.target
  if (!(target instanceof Element)) {
    return
  }

  if (target.closest('.selected-pill-popover--floating')) {
    return
  }

  if (target.closest('[data-achievement-popover-key]')) {
    return
  }

  closeCreateAchievementPopover()
}

function toggleCreateAchievementPopover(key: string, event?: Event) {
  if (createAchievementPopover.value === key) {
    closeCreateAchievementPopover()
    return
  }

  createAchievementPopover.value = key
  const anchor = event?.currentTarget
  if (anchor instanceof HTMLElement) {
    createAchievementPopoverAnchor.value = anchor.getBoundingClientRect()
    return
  }

  void nextTick(() => updateCreateAchievementPopoverPosition())
}

const createAchievementPopoverTemplate = computed(() => {
  const key = createAchievementPopover.value
  if (!key) {
    return null
  }

  const parsed = parseCreateAchievementPopoverKey(key)
  if (!parsed) {
    return null
  }

  return achievementTemplates.value.find((template) => template.id === parsed.templateId) ?? null
})

const createAchievementPopoverStyle = computed(() => {
  const rect = createAchievementPopoverAnchor.value
  if (!rect) {
    return { display: 'none' }
  }

  const viewportWidth = window.innerWidth
  const width = Math.min(320, viewportWidth * 0.7)
  const horizontalPadding = 12
  let left = rect.left + rect.width / 2 - width / 2
  left = Math.max(horizontalPadding, Math.min(left, viewportWidth - width - horizontalPadding))

  return {
    top: `${rect.bottom + 12}px`,
    left: `${left}px`,
    width: `${width}px`,
  }
})

watch(createAchievementPopover, async (key) => {
  if (!key) {
    detachCreateAchievementPopoverListeners()
    return
  }

  await nextTick()
  updateCreateAchievementPopoverPosition()
  attachCreateAchievementPopoverListeners()
})

function getCreateAchievementKey(scope: string, templateId: string) {
  return `${scope}-${templateId}`
}

function getHomeParticipant(eventId: string) {
  if (!currentUser.id) return null
  return (
    eventParticipantsByEventId.value[eventId]?.find((participant) => participant.userId === currentUser.id) ?? null
  )
}

function getEventAwards(eventId: string) {
  return eventAchievementAwardsByEventId.value[eventId] ?? []
}

function getHomeAwardedAchievements(event: GalleryEvent) {
  const participant = getHomeParticipant(event.id)
  if (!participant) return []

  return event.achievements.filter((achievement) =>
    getAwardsForAchievement(event, achievement).some((award) => award.participantId === participant.id),
  )
}

function isAchievementUnlockedForCurrentParticipant(achievement: EventAchievement) {
  return activeParticipantAchievementIds.value.has(achievement.id)
}

function isAchievementVisuallyEmphasized(achievement: EventAchievement) {
  return isAchievementUnlockedForCurrentParticipant(achievement)
}

function getNormalizedAchievementVisibility(achievement: EventAchievement): AchievementVisibility {
  return achievement.visibility ?? 'visible'
}

function getAchievementAwardCount(eventId: string, achievement: EventAchievement) {
  const event = getEventById(eventId)
  if (!event) return 0
  return getAwardsForAchievement(event, achievement).length
}

function isAchievementHiddenForCurrentParticipant(achievement: EventAchievement) {
  return (
    getNormalizedAchievementVisibility(achievement) === 'hidden' &&
    !isCurrentUserOrganizer(activeEvent.value) &&
    !isAchievementUnlockedForCurrentParticipant(achievement)
  )
}

function getAchievementCardTitle(achievement: EventAchievement) {
  if (isCurrentUserOrganizer(activeEvent.value) || isAchievementUnlockedForCurrentParticipant(achievement)) {
    return achievement.title
  }

  return achievement.title
}

function getAchievementCardDescription(achievement: EventAchievement) {
  if (isCurrentUserOrganizer(activeEvent.value) || isAchievementUnlockedForCurrentParticipant(achievement)) {
    return achievement.description
  }

  return getNormalizedAchievementVisibility(achievement) === 'hint'
    ? 'Условие скрыто'
    : achievement.description
}

function getAchievementCardIcon(achievement: EventAchievement) {
  if (isCurrentUserOrganizer(activeEvent.value) || isAchievementUnlockedForCurrentParticipant(achievement)) {
    return achievement.icon
  }

  return getNormalizedAchievementVisibility(achievement) === 'hint' ? achievement.icon : achievement.icon
}

function getAchievementAudienceLabel(eventId: string, achievement: EventAchievement) {
  const count = getAchievementAwardCount(eventId, achievement)
  const total = eventParticipantsByEventId.value[eventId]?.length ?? 0
  const unlocked = isAchievementUnlockedForCurrentParticipant(achievement)

  if (count === 0) return 'Пока нет ни у кого'
  if (count === 1 && unlocked) return 'Эксклюзив (есть только у вас)'
  if (count === 1) return 'Есть у 1 участника'
  return `Есть у ${count} из ${total || count} участников`
}

function getAchievementToneStyle(achievement: EventAchievement) {
  const [start = '#ffd166', end = '#41d3bd'] = (achievement.tone ?? '#ffd166,#41d3bd')
    .split(',')
    .map((part) => part.trim())

  return {
    '--achievement-tone': `${start}, ${end}`,
    '--achievement-accent': start,
  }
}

function getMedalTonePrimary(tone: string) {
  return tone.split(',')[0]?.trim() || '#ffd166'
}

function setMedalToneFromColor(color: string) {
  medalForm.value.tone = `${color},${color}`
}

function toggleEventAchievementDetails(achievementId: string) {
  openEventAchievementId.value = openEventAchievementId.value === achievementId ? null : achievementId
}

function isAchievementDetailsOpen(achievementId: string) {
  return openEventAchievementId.value === achievementId
}

function sortEventAchievements(achievements: EventAchievement[]) {
  return [...achievements].sort((left, right) => {
    const leftUnlocked = isAchievementUnlockedForCurrentParticipant(left)
    const rightUnlocked = isAchievementUnlockedForCurrentParticipant(right)
    if (leftUnlocked !== rightUnlocked) return leftUnlocked ? -1 : 1

    const order: Record<AchievementVisibility, number> = { visible: 0, hint: 1, hidden: 2 }
    const leftRank = order[getNormalizedAchievementVisibility(left)]
    const rightRank = order[getNormalizedAchievementVisibility(right)]
    if (leftRank !== rightRank) return leftRank - rightRank

    return (left.createdAt ?? '').localeCompare(right.createdAt ?? '') || left.title.localeCompare(right.title)
  })
}

function getVisibleEventAchievements(event: GalleryEvent) {
  const achievements = isCurrentUserOrganizer(activeEvent.value)
    ? event.achievements
    : event.achievements.filter((achievement) => !isAchievementHiddenForCurrentParticipant(achievement))

  return sortEventAchievements(achievements)
}

function getAchievementProgressPercent(event: GalleryEvent) {
  if (!event.achievements.length) return 0
  return (activeParticipantAchievementIds.value.size / event.achievements.length) * 100
}

function getHiddenAchievementCount(event: GalleryEvent) {
  return event.achievements.filter((achievement) => isAchievementHiddenForCurrentParticipant(achievement)).length
}

function getAchievementSummaryText(event: GalleryEvent) {
  return `${activeParticipantAchievementIds.value.size}/${event.achievements.length || 0}`
}

function getAchievementVisibilityBadge(achievement: EventAchievement) {
  const visibility = getNormalizedAchievementVisibility(achievement)
  if (visibility === 'hint') return 'Условие скрыто'
  if (visibility === 'hidden') return 'Полностью скрыто'
  return 'Открытое'
}

async function openAchievementAwardModal(achievement: EventAchievement) {
  if (!activeEvent.value) return
  achievementAwardEventId.value = activeEvent.value.id
  achievementAwardTarget.value = achievement
  achievementAwardError.value = ''
  achievementAwardModalOpen.value = true
  await syncEventParticipantsFromService(activeEvent.value.id)
  await syncEventAchievementAwardsFromService(activeEvent.value.id)
  achievementAwardSelections.value = achievementAwardParticipants.value
    .filter((participant) =>
      isAchievementAlreadyAwardedToParticipant(achievement.id, participant.id),
    )
    .map((participant) => participant.id)
}

function closeAchievementAwardModal() {
  achievementAwardModalOpen.value = false
  achievementAwardEventId.value = null
  achievementAwardTarget.value = null
  achievementAwardSelections.value = []
  achievementAwardError.value = ''
}

function isAchievementAlreadyAwardedToParticipant(achievementId: string, participantId: string) {
  const eventId = achievementAwardEventId.value ?? activeEventId.value
  if (!eventId) return false

  const event = getEventById(eventId)
  const achievement =
    event?.achievements.find((item) => item.id === achievementId) ?? achievementAwardTarget.value
  if (!event || !achievement) return false

  return getAwardsForAchievement(event, achievement).some((award) => award.participantId === participantId)
}

function toggleAchievementAwardSelection(participantId: string) {
  const next = new Set(achievementAwardSelections.value)
  if (next.has(participantId)) {
    next.delete(participantId)
  } else {
    next.add(participantId)
  }
  achievementAwardSelections.value = [...next]
}

async function submitAchievementAwards() {
  const eventId = achievementAwardEventId.value ?? activeEvent.value?.id
  const achievementId = achievementAwardTarget.value?.id
  if (!eventId || !achievementId || !currentUser.id) return

  const selectedIds = new Set(achievementAwardSelections.value)
  const participants = achievementAwardParticipants.value
  const toAward = participants.filter(
    (participant) =>
      selectedIds.has(participant.id) &&
      !isAchievementAlreadyAwardedToParticipant(achievementId, participant.id),
  )
  const toRevoke = participants.filter(
    (participant) =>
      !selectedIds.has(participant.id) &&
      isAchievementAlreadyAwardedToParticipant(achievementId, participant.id),
  )

  if (toAward.length === 0 && toRevoke.length === 0) {
    closeAchievementAwardModal()
    return
  }

  try {
    achievementAwardError.value = ''
    if (toRevoke.length > 0) {
      await achievementService.revokeAchievementFromParticipants(eventId, achievementId, toRevoke)
    }
    if (toAward.length > 0) {
      await achievementService.awardAchievementToParticipants(
        eventId,
        achievementId,
        toAward,
        currentUser.id,
      )
    }

    await refreshEventDataFromServices(eventId)
    closeAchievementAwardModal()
  } catch (error) {
    console.error('[achievements] sync failed', {
      error,
      eventId,
      achievementId,
      awardedByUserId: currentUser.id,
      toAward,
      toRevoke,
    })
    achievementAwardError.value =
      error instanceof Error ? error.message : 'Не удалось сохранить выдачу достижений. Проверьте права Appwrite.'
  }
}

async function deleteTemplate(templateId: string) {
  const template = achievementTemplates.value.find((item) => item.id === templateId)
  if (!template) return
  if (!window.confirm(`Удалить шаблон достижения "${template.title}"?`)) return

  await achievementService.deleteAchievementTemplate(templateId)
  await loadAchievementTemplates()
  createEventForm.value.selectedPersonalTemplateIds = createEventForm.value.selectedPersonalTemplateIds.filter(
    (id) => id !== templateId,
  )
  createEventForm.value.selectedGroupTemplateIds = createEventForm.value.selectedGroupTemplateIds.filter(
    (id) => id !== templateId,
  )
  const nextVisibility = { ...createEventForm.value.templateVisibility }
  delete nextVisibility[templateId]
  createEventForm.value.templateVisibility = nextVisibility
  if (createAchievementPopover.value?.endsWith(templateId)) {
    closeCreateAchievementPopover()
  }
}

function getTitleStyleClass(styleId: string) {
  return `title-style-${styleId}`
}

function normalizeRsvpStyleId(styleId: string) {
  return styleId === 'flirty' ? 'party' : styleId
}

function getRsvpStyleOption(styleId: string) {
  const normalizedId = normalizeRsvpStyleId(styleId)
  return rsvpStyleOptions.find((option) => option.id === normalizedId) ?? rsvpStyleOptions[0]
}

function getRsvpPreviewSymbols(styleId: string) {
  const normalizedId = normalizeRsvpStyleId(styleId)
  const symbolMap: Record<string, [string, string, string]> = {
    bloom: ['🌷', '🌼', '🥀'],
    party: ['🎉', '🕐', '🏠'],
    hearts: ['💖', '🫶', '💔'],
    icons: ['✓', '?', '×'],
  }

  return symbolMap[normalizedId] ?? symbolMap.icons
}

function getRsvpChoices(styleId: string): RsvpChoice[] {
  const symbols = getRsvpPreviewSymbols(styleId)
  const ids: RsvpStatus[] = ['going', 'maybe', 'not-going']
  return ids.map((id, index) => ({
    id,
    label: rsvpStatusLabels[id],
    symbol: symbols[index],
  }))
}

function getRsvpStatusVerb(status: RsvpStatus) {
  const verbs: Record<RsvpStatus, string> = {
    going: 'пойдёт',
    maybe: 'возможно придёт',
    'not-going': 'не сможет прийти',
  }
  return verbs[status]
}

function getRsvpSummary(event: GalleryEvent) {
  const going = event.guestRsvps.filter((entry) => entry.status === 'going').length
  const maybe = event.guestRsvps.filter((entry) => entry.status === 'maybe').length
  const cant = event.guestRsvps.filter((entry) => entry.status === 'not-going').length
  return { going, maybe, cant }
}

function getInfoBlockLabel(block: EventInfoBlock) {
  if (block.type === 'other') return block.title.trim() || 'Другое'
  return getInfoBlockTypeLabel(block.type, block.title)
}

function hasEventPayment(event: GalleryEvent | null | undefined) {
  const payment = event?.payment
  if (!payment) return false

  return Boolean(payment.amount?.trim() || payment.destination?.trim() || payment.comment?.trim())
}

function hasEventDetails(event: GalleryEvent | null | undefined) {
  if (!event) return false

  return Boolean(
    event.description?.trim() ||
      event.infoBlocks?.length ||
      hasEventPayment(event),
  )
}

function mergeEventMetadata(baseEvent: GalleryEvent, freshEvent: GalleryEvent) {
  return {
    ...baseEvent,
    ...freshEvent,
    photos: baseEvent.photos,
    guestRsvps: baseEvent.guestRsvps,
    chatMessages: baseEvent.chatMessages,
    achievements: baseEvent.achievements,
    savedCount: baseEvent.savedCount,
    totalCount: baseEvent.totalCount,
    role: baseEvent.role,
  }
}

function findAssetIdBySrc(list: AssetOption[], src: string) {
  return list.find((asset) => asset.src === src)?.id ?? ''
}

function openRsvpSheet(status: RsvpStatus) {
  if (currentView.value !== 'event' || !activeEvent.value) return
  if (isGoingRsvpBlockedForEvent(activeEvent.value, status)) {
    notifyCapacityFull()
    return
  }

  const currentRsvp = getCurrentUserRsvpEntry(activeEvent.value)
  rsvpSheetStatus.value = currentRsvp?.status ?? status
  rsvpSheetMessage.value = currentRsvp?.message ?? ''
  rsvpSheetOpen.value = true
}

function closeRsvpSheet() {
  rsvpSheetOpen.value = false
  rsvpSheetStatus.value = null
  rsvpSheetMessage.value = ''
}

// --- RSVP: ответ гостя, лимит мест, синхронизация с participant ---
async function submitRsvpResponse() {
  const event = activeEvent.value
  const status = rsvpSheetStatus.value
  if (!event || !status) return

  if (isGoingRsvpBlockedForEvent(event, status)) {
    notifyCapacityFull()
    return
  }

  const participant = currentParticipant.value ?? (await ensureCurrentParticipant(event))
  if (!participant) return

  const message = rsvpSheetMessage.value.trim()
  const statusLabel = rsvpStatusLabels[status]
  const chatText = message
    ? `${participant.displayName} отметил(а) «${statusLabel}»: ${message}`
    : `${participant.displayName} отметил(а) «${statusLabel}».`

  const persistableAvatarUrl = await getPersistableAuthorAvatarUrl(participant)

  let nextRsvp: EventRsvpEntry
  try {
    nextRsvp = await rsvpService.setParticipantRsvp({
      eventId: event.id,
      userId: currentUser.id,
      participantId: participant.id,
      displayName: participant.displayName,
      avatarUrl: persistableAvatarUrl,
      status,
      message: message || undefined,
    })
  } catch (error) {
    if (error instanceof Error && error.message === EVENT_CAPACITY_FULL_MESSAGE) {
      notifyCapacityFull()
      return
    }

    throw error
  }

  const nextMessage = await chatService.addEventMessage({
    eventId: event.id,
    userId: currentUser.id,
    participantId: participant.id,
    authorName: participant.displayName,
    authorAvatarUrl: persistableAvatarUrl,
    text: chatText,
  })

  await updateEventInList(event.id, (current) => ({
    ...current,
    guestRsvps: [
      ...current.guestRsvps.filter((entry) => {
        if (entry.id === nextRsvp.id) return false
        if (entry.participantId === nextRsvp.participantId) return false
        if (entry.userId && resolveCanonicalUserId(entry.userId, currentUser.id) === currentUser.id) return false
        return true
      }),
      nextRsvp,
    ],
    chatMessages: [...current.chatMessages, nextMessage],
  }))

  await syncEventGuestDataFromService(event.id)

  notifications.value = [
    {
      id: createId('notice'),
      title: 'Ответ на приглашение',
      text: `${participant.displayName} ${getRsvpStatusVerb(status)} на «${event.title}»${message ? `: ${message}` : '.'}`,
      time: 'сейчас',
    },
    ...notifications.value,
  ]

  closeRsvpSheet()
}

async function addEventPhoto(eventId: string, file: File, source: 'album' | 'chat') {
  const event = getEventById(eventId)
  if (!event) return

  const participant = currentParticipant.value ?? (await ensureCurrentParticipant(event))
  if (!participant) return

  const persistableAvatarUrl = await getPersistableAuthorAvatarUrl(participant)

  const photo = await photoService.addEventPhoto({
    eventId,
    userId: currentUser.id,
    participantId: participant.id,
    authorName: participant.displayName,
    authorAvatarUrl: persistableAvatarUrl,
    file,
  })

  const photoChatMessage =
    source === 'chat'
      ? await chatService.addEventMessage({
          eventId,
          userId: currentUser.id,
          participantId: participant.id,
          authorName: participant.displayName,
          authorAvatarUrl: persistableAvatarUrl,
          text: 'добавил(а) фото',
          photoId: photo.id,
        })
      : null

  await updateEventInList(eventId, (current) => {
    const nextEvent = {
      ...current,
      photos: [...current.photos, photo],
      chatMessages:
        photoChatMessage
          ? [
              ...current.chatMessages,
              photoChatMessage,
            ]
          : current.chatMessages,
    }
    syncEventSavedCount(nextEvent)
    return nextEvent
  })

  await syncEventPhotosFromService(eventId)
  if (photoChatMessage) {
    await syncEventMessagesFromService(eventId)
  }

  const refreshedEvent = getEventById(eventId)
  if (refreshedEvent) {
    const participants =
      eventParticipantsByEventId.value[eventId] ?? (await participantService.getEventParticipants(eventId))
    const achievements = await achievementService.getEventAchievements(eventId)
    const awards = getEventAwards(eventId)
    const awardsChanged = await processAutomaticAchievementsForEvent({
      event: { ...refreshedEvent, achievements },
      photos: refreshedEvent.photos,
      achievements,
      participants,
      awards,
      awardedByUserId: refreshedEvent.organizerId || currentUser.id,
    })

    if (awardsChanged) {
      await syncEventAchievementAwardsFromService(eventId)
    }
  }

  await addCurrentParticipantPoints(10)

  notifications.value = [
    {
      id: createId('notice'),
      title: 'Новое фото',
      text: `В событии «${event.title}» появилось новое фото.`,
      time: 'сейчас',
    },
    ...notifications.value,
  ]
}

function triggerAlbumPhotoPicker(eventId: string) {
  pendingAlbumEventId.value = eventId
  albumPhotoInput.value?.click()
}

function triggerChatPhotoPicker() {
  chatPhotoInput.value?.click()
}

function handleAlbumPhotoUpload(nativeEvent: Event) {
  const file = (nativeEvent.target as HTMLInputElement).files?.[0]
  const eventId = pendingAlbumEventId.value ?? activeEventId.value
  if (file && eventId) {
    void addEventPhoto(eventId, file, 'album')
  }
  pendingAlbumEventId.value = null
  ;(nativeEvent.target as HTMLInputElement).value = ''
}

function handleChatPhotoUpload(nativeEvent: Event) {
  const file = (nativeEvent.target as HTMLInputElement).files?.[0]
  if (file && activeEventId.value) {
    void addEventPhoto(activeEventId.value, file, 'chat')
  }
  ;(nativeEvent.target as HTMLInputElement).value = ''
}

function getEventPhotoById(event: GalleryEvent, photoId?: string) {
  if (!photoId) return null
  return event.photos.find((photo) => photo.id === photoId) ?? null
}

function populateFormFromEvent(event: GalleryEvent) {
  clearPendingEventVisualFiles()
  const start = toDateParts(event.startsAt)
  const end = toDateParts(event.endsAt)
  const coverMatch = findAssetIdBySrc(coverAssetOptions, event.coverStart)
  const backgroundMatch = findAssetIdBySrc(backgroundAssetOptions, event.backgroundStart)
  const isColorBackground = event.backgroundStart.startsWith('#')
  const matchedBackgroundAsset = backgroundMatch ? getAssetById(backgroundAssetOptions, backgroundMatch) : null
  const backgroundMediaType = isColorBackground
    ? createEmptyEventForm().backgroundMediaType
    : event.backgroundMediaType ??
      getAssetBackgroundMediaType(matchedBackgroundAsset) ??
      inferBackgroundMediaTypeFromSource(event.backgroundStart)

  createEventForm.value = {
    ...createEmptyEventForm(),
    title: event.title,
    titleStyle: event.titleStyle ?? 'classic',
    description: event.description ?? '',
    startDate: start.date,
    startHour: start.hour,
    startMinute: start.minute,
    endDate: end.date,
    endHour: end.hour,
    endMinute: end.minute,
    timezone:
      russianTimezoneOptions.find((zone) => formatTimezoneLabel(zone.id) === event.timezoneLabel)?.id ??
      'Asia/Yekaterinburg',
    hostAlias: event.organizerName,
    location: event.location === 'Место уточняется' ? '' : event.location,
    participantLimit: event.participantLimit ? String(event.participantLimit) : '',
    coverAssetId: coverMatch || createEmptyEventForm().coverAssetId,
    backgroundAssetId: backgroundMatch || createEmptyEventForm().backgroundAssetId,
    backgroundMode: isColorBackground ? 'color' : 'asset',
    backgroundMediaType,
    backgroundColor: isColorBackground ? event.backgroundStart : createEmptyEventForm().backgroundColor,
    uploadedCoverUrl: coverMatch ? null : isAssetSource(event.coverStart) ? event.coverStart : null,
    uploadedBackgroundUrl:
      !isColorBackground && !backgroundMatch && isAssetSource(event.backgroundStart)
        ? event.backgroundStart
        : null,
    infoBlocks: event.infoBlocks ? event.infoBlocks.map((block) => ({ ...block })) : [],
    paymentEnabled: Boolean(event.payment),
    costPerPerson: event.payment?.amount ?? '',
    paymentDestination: event.payment?.destination ?? '',
    paymentComment: event.payment?.comment ?? '',
    allowGuestInvites: Boolean(event.allowGuestInvites),
    rsvpStyle: normalizeRsvpStyleId(event.rsvpStyle ?? 'icons'),
    textTheme: normalizeFormTextTheme(event.textTheme, event),
    automaticExpanded: false,
    personalExpanded: false,
    groupExpanded: false,
    automaticTemplateIds: achievementTemplates.value
      .filter((template) => event.achievements.some((achievement) => achievement.title === template.title))
      .filter((template) => template.scope === 'automatic' && isSupportedAutomaticTemplateId(template.id))
      .map((template) => template.id),
    selectedPersonalTemplateIds: achievementTemplates.value
      .filter(
        (template) =>
          template.scope === 'personal' &&
          event.achievements.some((achievement) => achievement.title === template.title),
      )
      .map((template) => template.id),
    selectedGroupTemplateIds: achievementTemplates.value
      .filter(
        (template) =>
          template.scope === 'group' &&
          event.achievements.some((achievement) => achievement.title === template.title),
      )
      .map((template) => template.id),
    templateVisibility: event.achievements.reduce<Record<string, AchievementVisibility>>(
      (accumulator, achievement) => {
        if (!achievement.visibility || achievement.visibility === 'visible') {
          return accumulator
        }

        const templateId =
          achievement.templateId ??
          achievementTemplates.value.find((template) => template.title === achievement.title)?.id ??
          achievement.id

        accumulator[templateId] = achievement.visibility
        return accumulator
      },
      {},
    ),
  }
}

async function openEditEvent(eventId: string) {
  const event = getEventById(eventId)
  if (!event || event.role !== 'Организатор') return

  await syncEventAchievementsFromService(eventId)
  editingEventId.value = eventId
  populateFormFromEvent(getEventById(eventId) ?? event)
  createEventForm.value.automaticExpanded = false
  createEventForm.value.personalExpanded = false
  createEventForm.value.groupExpanded = false
  applyBackgroundColor(createEventForm.value.backgroundColor)
  enforceCreateDateTimeRules()
  currentView.value = 'create'
  createEventOpen.value = true
  medalBuilderOpen.value = false
  coverPickerOpen.value = false
  coverPickerTab.value = 'posters'
  coverSearchQuery.value = ''
  emojiPickerOpen.value = false
  closeCreateAchievementPopover()
  notificationsOpen.value = false
  profileMenuOpen.value = false
  previewDraftEvent.value = null
}

function scrollToCreateSection(sectionId: string) {
  document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function selectPresetCover(assetId: string) {
  uploadedCoverFile.value = null
  createEventForm.value.coverAssetId = assetId
  createEventForm.value.uploadedCoverUrl = null
  coverPickerOpen.value = false
}

function selectPresetBackground(asset: AssetOption) {
  uploadedBackgroundFile.value = null
  createEventForm.value.backgroundMode = 'asset'
  createEventForm.value.backgroundAssetId = asset.id
  createEventForm.value.uploadedBackgroundUrl = null
  createEventForm.value.backgroundMediaType = getAssetBackgroundMediaType(asset)
}

function handleCoverUpload(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file) {
    uploadedCoverFile.value = file
    createEventForm.value.uploadedCoverUrl = window.URL.createObjectURL(file)
    coverPickerOpen.value = false
  }
}

function handleBackgroundUpload(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file) {
    uploadedBackgroundFile.value = file
    createEventForm.value.backgroundMode = 'asset'
    createEventForm.value.backgroundMediaType = getBackgroundMediaTypeFromFile(file)
    createEventForm.value.uploadedBackgroundUrl = window.URL.createObjectURL(file)
  }
}

function createEventFromForm() {
  const coverAsset = selectedCoverAsset.value
  const backgroundAsset = selectedBackgroundAsset.value
  const safeStartsAt = startDateTime.value
  const safeEndsAt = endDateTime.value
  const backgroundMediaType =
    createEventForm.value.backgroundMode === 'color'
      ? undefined
      : createEventForm.value.uploadedBackgroundUrl
        ? createEventForm.value.backgroundMediaType
        : getAssetBackgroundMediaType(backgroundAsset)
  const hostName = clampTextLength(
    createEventForm.value.hostAlias.trim() || currentUser.name,
    USER_NAME_MAX_LENGTH,
  )
  const hostInitials =
    hostName
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part.slice(0, 1))
      .join('')
      .slice(0, 2)
      .toUpperCase() || currentUser.initials
  const automaticAchievements = selectedAutomaticTemplates.value.map((template) => {
    const visibility: AchievementVisibility = getTemplateVisibility(template.id)

    return {
      ...buildAchievementFromTemplate(template),
      visibility,
    }
  })
  const selectedTemplates = [...selectedPersonalTemplates.value, ...selectedGroupTemplates.value].map(
    (template) => {
      const visibility: AchievementVisibility = getTemplateVisibility(template.id)

      return {
        ...buildAchievementFromTemplate(template),
        visibility,
      }
    },
  )
  const payment = createEventForm.value.paymentEnabled
    ? {
        amount: createEventForm.value.costPerPerson,
        destination: createEventForm.value.paymentDestination,
        comment: createEventForm.value.paymentComment,
      }
    : null
  const trimmedBlocks = createEventForm.value.infoBlocks
    .map((block) => ({
      ...block,
      title: block.title.trim(),
      description: block.description.trim(),
      link: block.link.trim(),
    }))
    .filter((block) => block.title || block.description || block.link)

  const newEvent: GalleryEvent = {
    id: createId('event'),
    title: clampTextLength(createEventForm.value.title, EVENT_TITLE_MAX_LENGTH),
    status: buildEventStatus(safeStartsAt, safeEndsAt),
    startsAt: safeStartsAt,
    endsAt: safeEndsAt,
    role: currentUser.role,
    organizerId: currentUser.id,
    organizerName: hostName,
    organizerInitials: hostInitials,
    organizerTone: '#ffd166,#41d3bd',
    organizerAvatarSrc: getCurrentUserAvatarUrlForDocuments(),
    description: createEventForm.value.description.trim(),
    location: createEventForm.value.location.trim() || 'Место уточняется',
    savedCount: 0,
    totalCount: 0,
    coverStart: coverAsset?.src ?? '#ff7a59',
    coverEnd: coverAsset?.src ?? '#ffd166',
    coverFileId: undefined,
    backgroundStart:
      createEventForm.value.backgroundMode === 'color'
        ? createEventForm.value.backgroundColor
        : backgroundAsset?.src ?? '#f8f7f2',
    backgroundEnd:
      createEventForm.value.backgroundMode === 'color'
        ? '#fffaf6'
        : backgroundAsset?.src ?? '#ffffff',
    backgroundFileId: undefined,
    backgroundUrl:
      createEventForm.value.backgroundMode === 'color'
        ? undefined
        : backgroundAsset?.src ?? undefined,
    backgroundMode: createEventForm.value.backgroundMode,
    backgroundMediaType,
    backgroundColor: createEventForm.value.backgroundColor,
    accent:
      createEventForm.value.backgroundMode === 'color'
        ? createEventForm.value.backgroundColor
        : '#ff7a59',
    allowGuestInvites: createEventForm.value.allowGuestInvites,
    participantLimit: Number(createEventForm.value.participantLimit) || null,
    infoBlocks: trimmedBlocks,
    payment,
    timezoneLabel: formatTimezoneLabel(createEventForm.value.timezone),
    achievements: [
      ...automaticAchievements,
      ...selectedTemplates,
    ],
    photos: [],
    chatMessages: [],
    guestRsvps: [],
    titleStyle: createEventForm.value.titleStyle,
    rsvpStyle: createEventForm.value.rsvpStyle,
    textTheme: createEventForm.value.textTheme,
  }

  return newEvent
}

async function persistEventVisualUploads(event: GalleryEvent, existingEvent?: GalleryEvent) {
  if (!isAppwriteMode()) {
    return event
  }

  const nextEvent: GalleryEvent = { ...event }

  if (uploadedCoverFile.value) {
    const uploadedCover = await storageService.uploadEventVisual(uploadedCoverFile.value, 'cover')
    nextEvent.coverFileId = uploadedCover.fileId
    nextEvent.coverStart = uploadedCover.previewUrl
    nextEvent.coverEnd = uploadedCover.previewUrl
  } else if (createEventForm.value.uploadedCoverUrl) {
    nextEvent.coverFileId = existingEvent?.coverFileId
    if (existingEvent?.coverFileId) {
      nextEvent.coverStart = existingEvent.coverStart
      nextEvent.coverEnd = existingEvent.coverEnd
    }
  } else {
    nextEvent.coverFileId = undefined
  }

  if (createEventForm.value.backgroundMode === 'color') {
    nextEvent.backgroundFileId = undefined
    nextEvent.backgroundUrl = undefined
    nextEvent.backgroundMode = 'color'
    nextEvent.backgroundMediaType = undefined
    nextEvent.backgroundColor = createEventForm.value.backgroundColor
    nextEvent.backgroundStart = createEventForm.value.backgroundColor
    nextEvent.backgroundEnd = '#fffaf6'
    return nextEvent
  }

  nextEvent.backgroundMode = 'asset'
  nextEvent.backgroundMediaType = nextEvent.backgroundMediaType ?? createEventForm.value.backgroundMediaType
  nextEvent.backgroundColor = createEventForm.value.backgroundColor

  if (uploadedBackgroundFile.value) {
    const uploadedBackground = await storageService.uploadEventVisual(uploadedBackgroundFile.value, 'background')
    nextEvent.backgroundFileId = uploadedBackground.fileId
    nextEvent.backgroundUrl = uploadedBackground.previewUrl
    nextEvent.backgroundMediaType = getBackgroundMediaTypeFromFile(uploadedBackgroundFile.value)
    nextEvent.backgroundStart = uploadedBackground.previewUrl
    nextEvent.backgroundEnd = uploadedBackground.previewUrl
  } else if (createEventForm.value.uploadedBackgroundUrl) {
    nextEvent.backgroundFileId = existingEvent?.backgroundFileId
    nextEvent.backgroundUrl = existingEvent?.backgroundUrl ?? existingEvent?.backgroundStart
    if (existingEvent?.backgroundFileId) {
      nextEvent.backgroundStart = existingEvent.backgroundStart
      nextEvent.backgroundEnd = existingEvent.backgroundEnd
    }
  } else {
    nextEvent.backgroundFileId = undefined
    nextEvent.backgroundUrl = nextEvent.backgroundStart
  }

  return nextEvent
}

async function saveEvent() {
  enforceCreateDateTimeRules()
  if (!canSaveEvent.value || eventSaveInProgress.value) return

  eventSaveInProgress.value = true

  try {
    if (editingEventId.value) {
      const existing = getEventById(editingEventId.value)
      if (!existing) return

      let updated = createEventFromForm()
      updated.id = existing.id
      updated.photos = existing.photos
      updated.chatMessages = existing.chatMessages
      updated.guestRsvps = existing.guestRsvps
      updated.savedCount = existing.savedCount
      updated.role = existing.role
      updated.status = buildEventStatus(updated.startsAt, updated.endsAt)
      updated = await persistEventVisualUploads(updated, existing)
      syncEventSavedCount(updated)

      await eventService.updateEvent(updated)

      const savedEvent = buildSavedEventFromExisting(existing, updated)
      await completeEventEditorTransition(savedEvent, {
        title: 'Событие обновлено',
        text: `Изменения в «${updated.title}» сохранены.`,
      })
      void syncEventAfterSave(updated.id, updated.organizerName)
      return
    }

    let nextEvent = createEventFromForm()
    nextEvent = await persistEventVisualUploads(nextEvent)
    await eventService.createEvent(nextEvent)

    expandedEvents.value = new Set()
    activeAchievement.value = null
    await completeEventEditorTransition(nextEvent, {
      title: 'Событие создано',
      text: `Новое событие "${nextEvent.title}" добавлено в ваш Home.`,
    })
    void syncEventAfterSave(nextEvent.id, nextEvent.organizerName)
  } catch (error) {
    notifications.value = [
      {
        id: createId('notice'),
        title: 'Не удалось сохранить событие',
        text: error instanceof Error ? error.message : 'Попробуйте ещё раз.',
        time: 'сейчас',
      },
      ...notifications.value,
    ]
  } finally {
    eventSaveInProgress.value = false
  }
}

  return reactive({
    isAchievementUnlockedForCurrentParticipant,
    isAchievementAlreadyAwardedToParticipant,
    getEventBackgroundScrimClassForEvent,
    getCurrentUserAvatarUrlForDocuments,
    getEventBackgroundScrimClassForForm,
    getNormalizedAchievementVisibility,
    createAchievementPopoverTemplate,
    isAchievementVisuallyEmphasized,
    toggleAchievementAwardSelection,
    getEventTextThemeClassForEvent,
    handlePhotoViewerBackdropClick,
    toggleCreateAchievementPopover,
    createAchievementPopoverStyle,
    getAchievementCardDescription,
    getAchievementProgressPercent,
    getAchievementVisibilityBadge,
    profileEditorAvatarPreviewUrl,
    toggleEventAchievementDetails,
    viewerEventBackgroundGradient,
    achievementAwardParticipants,
    availableAutomaticTemplates,
    getAchievementAudienceLabel,
    getAssetBackgroundMediaType,
    getVisibleEventAchievements,
    achievementAwardSelections,
    availablePersonalTemplates,
    closeAchievementAwardModal,
    getHomeAwardedAchievements,
    hasCurrentUserAvatarVisual,
    isGoingRsvpBlockedForEvent,
    selectedAutomaticTemplates,
    triggerProfileAvatarPicker,
    viewerEventBackgroundImage,
    achievementAwardModalOpen,
    dismissGuestPersistBanner,
    getAchievementSummaryText,
    getCurrentAuthorAvatarUrl,
    getHiddenAchievementCount,
    getMessageAuthorAvatarUrl,
    getParticipantDisplayName,
    getResolvedTextThemeLabel,
    handleProfileAvatarUpload,
    highlightedGuestRsvpEntry,
    openAchievementAwardModal,
    removeSelectedAchievement,
    selectedPersonalTemplates,
    createAchievementPopover,
    getCurrentUserRsvpStatus,
    getMessageAuthorInitials,
    hasRealAuthenticatedUser,
    isAchievementDetailsOpen,
    achievementAwardEventId,
    activeCoverPickerAssets,
    availableGroupTemplates,
    canShowHomeAchievements,
    createResolvedTextTheme,
    expandableVisibleEvents,
    getAchievementCardTitle,
    getAchievementToneStyle,
    getCreateAchievementKey,
    getParticipantAvatarUrl,
    getRsvpEntryDisplayName,
    openGuestProfileUpgrade,
    selectedBackgroundAsset,
    setCreatePaymentEnabled,
    submitAchievementAwards,
    toggleAutomaticTemplate,
    triggerAlbumPhotoPicker,
    updateBackgroundFromHue,
    achievementAwardTarget,
    authEmailCodeRequested,
    backgroundAssetOptions,
    formatPhotoPostedLabel,
    getAchievementCardIcon,
    getPhotoThumbToneStyle,
    handleAlbumPhotoUpload,
    handleBackgroundUpload,
    highlightedGuestRsvpId,
    isCurrentUserOrganizer,
    selectPresetBackground,
    selectedGroupTemplates,
    showGuestPersistBanner,
    toggleHighlightedGuest,
    triggerChatPhotoPicker,
    EVENT_TITLE_MAX_LENGTH,
    getEventTextThemeClass,
    achievementAwardError,
    achievementsPanelOpen,
    createBackgroundStyle,
    getRsvpEntryAvatarUrl,
    getTemplateVisibility,
    handleChatPhotoUpload,
    scrollToCreateSection,
    selectRsvpSheetStatus,
    setMedalToneFromColor,
    setTemplateVisibility,
    applyBackgroundColor,
    formatEventDateLabel,
    formatShortEventDate,
    getEventSurfaceStyle,
    getMessageAuthorName,
    getRsvpEntryInitials,
    sendEventChatMessage,
    softBackgroundColors,
    toggleManualTemplate,
    USER_NAME_MAX_LENGTH,
    availableEndMinutes,
    eventSaveInProgress,
    getAvatarCacheToken,
    getGoingRsvpEntries,
    getMedalTonePrimary,
    getPhotoAuthorLabel,
    getPhotoImageSource,
    onEmojiPickerSelect,
    toggleEventExpanded,
    allVisibleExpanded,
    backgroundColorHue,
    canShowEventInvite,
    closeProfileEditor,
    currentParticipant,
    emojiPickerOptions,
    getRsvpStyleOption,
    getTitleStyleClass,
    inviteErrorMessage,
    profileAvatarInput,
    profileEditorError,
    selectedCoverAsset,
    submitRsvpResponse,
    activeAchievement,
    authEmailDelivery,
    availableEndHours,
    buildUserInitials,
    closeGuestPreview,
    getAchievementKey,
    getEventPhotoById,
    getInfoBlockLabel,
    handleCoverUpload,
    isVideoBackground,
    openProfileEditor,
    pendingInviteCode,
    profileEditorName,
    profileEditorOpen,
    saveProfileEditor,
    selectPresetCover,
    titleStyleOptions,
    toggleAchievement,
    toggleProfileMenu,
    getEventInviteUrl,
    isEventAtCapacity,
    activePhotoEntry,
    closeCreateEvent,
    coverSearchQuery,
    inviteLinkStatus,
    medalBuilderOpen,
    medalToneOptions,
    openGuestPreview,
    openMedalBuilder,
    quickInfoOptions,
    russianTimezoneOptions,
    eventTextThemeOptions,
    rsvpSheetMessage,
    rsvpStyleOptions,
    togglePhotoSaved,
    albumPhotoInput,
    appInitializing,
    canExpandOnHome,
    coverPickerOpen,
    createEventForm,
    emojiPickerOpen,
    hasEventDetails,
    hasEventPayment,
    isEventExpanded,
    openCreateEvent,
    photoViewerMode,
    profileMenuOpen,
    removeInfoBlock,
    requestAuthCode,
    rsvpSheetStatus,
    saveCustomMedal,
    toggleAllEvents,
    chatPhotoInput,
    closeEventPage,
    closeRsvpSheet,
    copyInviteLink,
    coverPickerTab,
    deleteTemplate,
    editingEventId,
    endBeforeStart,
    eventChatDraft,
    getAvatarStyle,
    getRsvpChoices,
    getRsvpSummary,
    getSavedPhotos,
    authGuestName,
    eventPageData,
    isAssetSource,
    minuteOptions,
    openEditEvent,
    openEventPage,
    openRsvpSheet,
    rsvpSheetOpen,
    visibleEvents,
    canSaveEvent,
    completeAuth,
    getAssetById,
    getEventById,
    isPhotoSaved,
    setActiveTab,
    activeEvent,
    currentUser,
    currentView,
    hourOptions,
    homeEvents,
    activeTab,
    authEmail,
    authError,
    medalForm,
    openPhoto,
    saveEvent,
    stepPhoto,
    authCode,
    authMode,
    authOpen,
    createId,
    openAuth,
    logout,
  })
}
