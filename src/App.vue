<script setup lang="ts">
import 'emoji-picker-element'
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { buildEventStatus } from './data/mockEvents'
import { authService } from './services/authService'
import { achievementService } from './services/achievementService'
import { chatService } from './services/chatService'
import { eventService, getEventInviteUrl } from './services/eventService'
import { participantService } from './services/participantService'
import { photoCommentService } from './services/photoCommentService'
import { photoService } from './services/photoService'
import { rsvpService } from './services/rsvpService'
import { savedPhotoService } from './services/savedPhotoService'
import { storageService } from './services/storageService'
import { isAppwriteMode } from './services/adapters/dataMode'
import type {
  AchievementScope,
  AchievementTemplate,
  EventAchievement,
  MedalForm,
} from './types/achievement'
import type {
  AssetOption,
  BackgroundMediaType,
  CreateEventForm,
  EventInfoBlock,
  EventInfoBlockType,
  EventPaymentInfo,
  EventTab,
  EventTheme,
  GalleryEvent,
  HomeNotification,
  RsvpChoice,
  RsvpStatus,
  TimezoneOption,
} from './types/event'
import type { EventParticipant } from './types/participant'
import type { GalleryPhoto } from './types/photo'
import type { PhotoComment } from './types/photoComment'
import type { EventChatMessage } from './types/chat'
import type { EventRsvpEntry } from './types/rsvp'
import type { CurrentUser } from './types/user'

type AuthMode = 'guest' | 'profile'
type ViewMode = 'landing' | 'home' | 'create' | 'preview' | 'event'
type CurrentUserView = CurrentUser & {
  initials: string
  name: string
  role: 'Организатор'
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

const infoBlockTypeOptions: Array<{ emoji: string; label: string; value: EventInfoBlockType }> = [
  { value: 'dress-code', label: 'Дресс-код', emoji: '👔' },
  { value: 'playlist', label: 'Плейлист', emoji: '🎵' },
  { value: 'bring', label: 'Что взять', emoji: '👜' },
  { value: 'link', label: 'Ссылка', emoji: '🔗' },
  { value: 'schedule', label: 'Расписание', emoji: '🕒' },
  { value: 'payment', label: 'Реквизиты', emoji: '💸' },
  { value: 'other', label: 'Другое', emoji: '📝' },
]

const quickInfoOptions = infoBlockTypeOptions.filter((option) =>
  ['link', 'playlist', 'dress-code'].includes(option.value),
)

const rsvpStyleOptions = [
  { id: 'icons', label: 'Icons', emoji: '👍' },
  { id: 'bloom', label: 'Bloom', emoji: '🌷' },
  { id: 'flirty', label: 'Flirty', emoji: '💋' },
  { id: 'hearts', label: 'Hearts', emoji: '💖' },
]

const titleStyleOptions = [
  { id: 'classic', label: 'Classic' },
  { id: 'eclectic', label: 'Eclectic' },
  { id: 'fancy', label: 'Fancy' },
  { id: 'literary', label: 'Literary' },
]

const medalToneOptions = [
  '#ff7a59,#ffd166',
  '#41d3bd,#5b8def',
  '#5b8def,#f7f06d',
  '#ff4d6d,#ffffff',
  '#8a5cf6,#ffb703',
  '#151515,#ffffff',
]

const russianTimezoneOptions: TimezoneOption[] = [
  { id: 'Europe/Kaliningrad', label: 'Калининград (UTC+2)' },
  { id: 'Europe/Moscow', label: 'Москва (UTC+3)' },
  { id: 'Europe/Samara', label: 'Самара (UTC+4)' },
  { id: 'Asia/Yekaterinburg', label: 'Екатеринбург (UTC+5)' },
  { id: 'Asia/Omsk', label: 'Омск (UTC+6)' },
  { id: 'Asia/Krasnoyarsk', label: 'Красноярск (UTC+7)' },
  { id: 'Asia/Irkutsk', label: 'Иркутск (UTC+8)' },
  { id: 'Asia/Yakutsk', label: 'Якутск (UTC+9)' },
  { id: 'Asia/Vladivostok', label: 'Владивосток (UTC+10)' },
  { id: 'Asia/Sakhalin', label: 'Сахалин (UTC+11)' },
  { id: 'Asia/Magadan', label: 'Магадан (UTC+11)' },
  { id: 'Asia/Kamchatka', label: 'Камчатка (UTC+12)' },
]

const softBackgroundColors = [
  '#ffd8d8',
  '#ffdcb8',
  '#ffe8a8',
  '#d6f0b4',
  '#cdeee2',
  '#d9e8ff',
  '#e6dcff',
  '#f6d9f6',
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
      .toUpperCase() || 'Ю'
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

function getAvatarStyle(avatarUrl?: string) {
  return avatarUrl
    ? {
        backgroundImage: `url("${avatarUrl}")`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    : undefined
}

const currentUser = reactive<CurrentUserView>({
  id: 'guest_demo',
  mode: 'demo',
  displayName: 'Юрий',
  avatarUrl: undefined,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  initials: 'Ю',
  name: 'Юрий',
  role: 'Организатор',
})

function hasRealAuthenticatedUser() {
  return !isAppwriteMode() || currentUser.mode !== 'demo'
}

const coverAssetModules = import.meta.glob(
  '../приеры страниц partiful/Ресурсы/Обложки/**/*.{png,jpg,jpeg,jfif,avif,webp,gif}',
  {
    eager: true,
    import: 'default',
  },
) as Record<string, string>

const backgroundAssetModules = import.meta.glob(
  '../приеры страниц partiful/Ресурсы/Фон/*.{png,jpg,jpeg,jfif,avif,webp,mp4,webm}',
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

function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36)}`
}

function applyCurrentUser(user: CurrentUser) {
  currentUser.id = user.id
  currentUser.mode = user.mode
  currentUser.email = user.email
  currentUser.displayName = user.displayName
  currentUser.avatarUrl = user.avatarUrl
  currentUser.createdAt = user.createdAt
  currentUser.updatedAt = user.updatedAt
  currentUser.avatarEmoji = user.avatarEmoji
  currentUser.name =
    user.displayName?.trim() || (user.mode === 'demo' ? 'Юрий' : `Гость ${String(user.id).slice(-4)}`)
  currentUser.initials = buildUserInitials(currentUser.name)
}

function buildRuntimeDemoUser(): CurrentUser {
  const now = new Date().toISOString()
  return {
    id: 'demo-local',
    mode: 'demo',
    displayName: 'Юрий',
    createdAt: now,
    updatedAt: now,
  }
}

async function initializeCurrentUser() {
  const storedUser = await authService.getCurrentUser()
  const nextUser =
    storedUser ?? (isAppwriteMode() ? buildRuntimeDemoUser() : await authService.createDemoUser('Юрий'))
  applyCurrentUser(nextUser)
  await loadHomeEvents()
  await syncAllEventPhotosFromService()
  await syncAllEventRsvpsFromService()
  await syncAllEventMessagesFromService()
  await syncAllEventAchievementsFromService()
  await resolveInviteFlow()
}

async function loadAchievementTemplates() {
  achievementTemplates.value = await achievementService.getAchievementTemplates()
}

async function loadHomeEvents() {
  homeEvents.value = await eventService.getHomeEvents()
  return homeEvents.value
}

function upsertHomeEvent(event: GalleryEvent) {
  homeEvents.value = homeEvents.value.some((item) => item.id === event.id)
    ? homeEvents.value.map((item) => (item.id === event.id ? event : item))
    : [...homeEvents.value, event]
}

function readInviteCodeFromLocation() {
  if (typeof window === 'undefined') {
    return ''
  }

  const url = new URL(window.location.href)
  return url.searchParams.get('event')?.trim().toUpperCase() ?? ''
}

function replaceInviteCodeInUrl(inviteCode: string | null) {
  if (typeof window === 'undefined') {
    return
  }

  const url = new URL(window.location.href)
  if (inviteCode) {
    url.searchParams.set('event', inviteCode)
  } else {
    url.searchParams.delete('event')
  }

  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
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

async function resolveInviteFlow() {
  const inviteCode = readInviteCodeFromLocation()
  if (!inviteCode) {
    pendingInviteCode.value = null
    pendingInviteEventId.value = null
    inviteErrorMessage.value = ''
    return
  }

  pendingInviteCode.value = inviteCode

  if (isAppwriteMode() && !hasRealAuthenticatedUser()) {
    inviteErrorMessage.value = ''
    authMode.value = 'guest'
    authGuestName.value = ''
    authError.value = ''
    authOpen.value = true
    return
  }

  const event = await eventService.getEventByInviteCode(inviteCode)
  if (!event) {
    pendingInviteEventId.value = null
    inviteErrorMessage.value = `Событие с кодом ${inviteCode} не найдено.`
    currentView.value = hasRealAuthenticatedUser() ? 'home' : 'landing'
    return
  }

  inviteErrorMessage.value = ''
  pendingInviteEventId.value = event.id
  upsertHomeEvent(event)
  activeTab.value = event.status
  openEventPage(event.id, event)

  if (hasRealAuthenticatedUser()) {
    const participant = await ensureCurrentParticipant(event)
    if (participant) {
      await loadHomeEvents()
    }
  }
}

function getThemeById(themeId: string) {
  return themes.find((theme) => theme.id === themeId) ?? themes[0]
}

function buildDefaultDate(offsetDays = 2, hour = 19) {
  const nextDate = new Date()
  nextDate.setDate(nextDate.getDate() + offsetDays)
  nextDate.setHours(hour, 0, 0, 0)
  const year = nextDate.getFullYear()
  const month = String(nextDate.getMonth() + 1).padStart(2, '0')
  const day = String(nextDate.getDate()).padStart(2, '0')
  const hours = String(nextDate.getHours()).padStart(2, '0')
  const minutes = String(nextDate.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

function padNumber(value: number) {
  return String(value).padStart(2, '0')
}

function toDateParts(value: string) {
  const date = new Date(value)
  return {
    date: value.slice(0, 10),
    hour: padNumber(date.getHours()),
    minute: padNumber(date.getMinutes()),
  }
}

function buildDateTimeFromParts(date: string, hour: string, minute: string) {
  return `${date}T${hour}:${minute}`
}

function formatTimezoneLabel(timezoneId: string) {
  return (
    russianTimezoneOptions.find((option) => option.id === timezoneId)?.label ??
    russianTimezoneOptions[3].label
  )
}

function hslToHex(hue: number, saturation: number, lightness: number) {
  const sat = saturation / 100
  const light = lightness / 100
  const chroma = sat * Math.min(light, 1 - light)
  const channel = (offset: number) => {
    const segment = (offset + hue / 30) % 12
    const color = light - chroma * Math.max(Math.min(segment - 3, 9 - segment, 1), -1)
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, '0')
  }

  return `#${channel(0)}${channel(8)}${channel(4)}`
}

function hexToHsl(hex: string) {
  const normalized = hex.replace('#', '')
  const source =
    normalized.length === 3
      ? normalized
          .split('')
          .map((item) => item + item)
          .join('')
      : normalized
  const red = Number.parseInt(source.slice(0, 2), 16) / 255
  const green = Number.parseInt(source.slice(2, 4), 16) / 255
  const blue = Number.parseInt(source.slice(4, 6), 16) / 255
  const max = Math.max(red, green, blue)
  const min = Math.min(red, green, blue)
  const delta = max - min
  let hue = 0
  const lightness = (max + min) / 2
  const saturation =
    delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1))

  if (delta !== 0) {
    switch (max) {
      case red:
        hue = ((green - blue) / delta) % 6
        break
      case green:
        hue = (blue - red) / delta + 2
        break
      default:
        hue = (red - green) / delta + 4
        break
    }
    hue *= 60
    if (hue < 0) hue += 360
  }

  return {
    h: Math.round(hue),
    s: Math.round(saturation * 100),
    l: Math.round(lightness * 100),
  }
}

function applyBackgroundColor(color: string) {
  createEventForm.value.backgroundColor = color
  const hsl = hexToHsl(color)
  backgroundColorHue.value = hsl.h
}

function updateBackgroundFromHue() {
  createEventForm.value.backgroundColor = hslToHex(backgroundColorHue.value, 68, 88)
}

function onEmojiPickerSelect(event: Event) {
  const detail = (event as CustomEvent<{ unicode: string }>).detail
  medalForm.value.icon = detail.unicode
  emojiPickerOpen.value = false
}

function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace('#', '')
  const source =
    normalized.length === 3
      ? normalized
          .split('')
          .map((item) => item + item)
          .join('')
      : normalized
  const red = Number.parseInt(source.slice(0, 2), 16)
  const green = Number.parseInt(source.slice(2, 4), 16)
  const blue = Number.parseInt(source.slice(4, 6), 16)
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}

function buildSoftColorGradient(color: string) {
  return `
    radial-gradient(circle at 50% 42%, rgba(255, 255, 255, 0.97) 0%, rgba(255, 255, 255, 0.92) 30%, ${hexToRgba(color, 0.72)} 100%),
    linear-gradient(135deg, ${hexToRgba(color, 0.86)}, rgba(255, 255, 255, 0.94) 56%, ${hexToRgba(color, 0.64)})
  `
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

function createEmptyEventForm(): CreateEventForm {
  const startDefault = toDateParts(buildDefaultDate(2, 19))
  const endDefault = toDateParts(buildDefaultDate(2, 23))
  return {
    title: '',
    titleStyle: titleStyleOptions[0].id,
    description: '',
    startDate: startDefault.date,
    startHour: startDefault.hour,
    startMinute: startDefault.minute,
    endDate: endDefault.date,
    endHour: endDefault.hour,
    endMinute: endDefault.minute,
    timezone: 'Asia/Yekaterinburg',
    hostAlias: currentUser.name,
    location: '',
    participantLimit: '',
    paymentEnabled: false,
    costPerPerson: '',
    coverAssetId: coverAssetOptions[0]?.id ?? '',
    backgroundAssetId: backgroundAssetOptions[0]?.id ?? '',
    backgroundMode: 'asset',
    backgroundMediaType: getAssetBackgroundMediaType(backgroundAssetOptions[0]),
    backgroundColor: softBackgroundColors[0],
    uploadedCoverUrl: null,
    uploadedBackgroundUrl: null,
    infoBlocks: [],
    paymentDestination: '',
    paymentComment: '',
    allowGuestInvites: false,
    rsvpStyle: rsvpStyleOptions[2]?.id ?? rsvpStyleOptions[0].id,
    automaticExpanded: false,
    personalExpanded: true,
    groupExpanded: true,
    automaticTemplateIds: [],
    selectedPersonalTemplateIds: [],
    selectedGroupTemplateIds: [],
  }
}

function createEmptyMedalForm(): MedalForm {
  return {
    title: '',
    description: '',
    scope: 'personal',
    icon: '🏅',
    tone: medalToneOptions[0],
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
  return canExpandOnHome(event) && event.achievements.length > 0
}

function getSavedPhotos(event: GalleryEvent) {
  return event.photos.filter((photo) => photo.saved)
}

function getPhotoImageSource(photo: GalleryPhoto) {
  return photo.imageUrl ?? photo.src ?? ''
}

function getPhotoLikesCount(photo: GalleryPhoto) {
  return Number(photo.likesCount ?? photo.likes ?? 0) || 0
}

function getPhotoCommentCountLabel(count: number) {
  if (count % 10 === 1 && count % 100 !== 11) return `${count} комментарий`
  if (count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 12 || count % 100 > 14)) {
    return `${count} комментария`
  }
  return `${count} комментариев`
}

function getPhotoStyle(photo: GalleryPhoto) {
  const imageSource = getPhotoImageSource(photo)
  if (imageSource) {
    return {
      backgroundImage: `url("${imageSource}")`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    }
  }

  return { '--photo-tone': photo.tone }
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

function getCoverBackground(event: GalleryEvent) {
  if (isAssetSource(event.coverStart)) {
    return `url("${event.coverStart}")`
  }

  return `linear-gradient(135deg, ${event.coverStart}, ${event.coverEnd})`
}

function getBackgroundBackground(event: GalleryEvent) {
  if (isAssetSource(event.backgroundStart)) {
    return `url("${event.backgroundStart}")`
  }

  if (event.backgroundStart.startsWith('#')) {
    return event.backgroundStart
  }

  return `linear-gradient(135deg, ${event.backgroundStart}, ${event.backgroundEnd})`
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
    createdBy: currentUser.id,
    createdAt: new Date().toISOString(),
    conditionType: template.conditionType,
  }
}

const selectedTheme = ref<EventTheme>(themes[0])
const homeEvents = ref<GalleryEvent[]>([])
const authOpen = ref(false)
const authMode = ref<AuthMode>('guest')
const authGuestName = ref('')
const authEmail = ref('')
const authCode = ref('')
const authError = ref('')
const authEmailCodeRequested = ref(false)
const currentView = ref<ViewMode>('landing')
const activeTab = ref<EventTab>('current')
const profileMenuOpen = ref(false)
const notificationsOpen = ref(false)
const expandedEvents = ref<Set<string>>(new Set())
const selectedPhoto = ref<{ eventId: string; photoId: string } | null>(null)
const selectedPhotoComments = ref<PhotoComment[]>([])
const photoCommentDraft = ref('')
const photoCommentError = ref('')
const activeAchievement = ref<string | null>(null)
const createEventOpen = ref(false)
const medalBuilderOpen = ref(false)
const activeEventId = ref<string | null>(null)
const pendingInviteCode = ref<string | null>(null)
const pendingInviteEventId = ref<string | null>(null)
const inviteErrorMessage = ref('')
const inviteLinkStatus = ref('')
const previewDraftEvent = ref<GalleryEvent | null>(null)
const eventChatDraft = ref('')
const editingEventId = ref<string | null>(null)
const rsvpSheetOpen = ref(false)
const rsvpSheetStatus = ref<RsvpStatus | null>(null)
const rsvpSheetMessage = ref('')
const albumPhotoInput = ref<HTMLInputElement | null>(null)
const chatPhotoInput = ref<HTMLInputElement | null>(null)
const profileAvatarInput = ref<HTMLInputElement | null>(null)
const pendingAlbumEventId = ref<string | null>(null)
const profileEditorOpen = ref(false)
const profileEditorName = ref('')
const profileEditorAvatarUrl = ref<string | null>(null)
const profileEditorError = ref('')

void initializeCurrentUser()
void loadAchievementTemplates()

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
const backgroundColorHue = ref(28)
const createAchievementPopover = ref<string | null>(null)
const createEventForm = ref<CreateEventForm>(createEmptyEventForm())
const medalForm = ref<MedalForm>(createEmptyMedalForm())

const hourOptions = Array.from({ length: 24 }, (_, index) => padNumber(index))
const minuteOptions = Array.from({ length: 60 }, (_, index) => padNumber(index))

function getLocalDateString(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getNowParts() {
  const now = new Date()
  return {
    date: getLocalDateString(now),
    hour: padNumber(now.getHours()),
    minute: padNumber(now.getMinutes()),
  }
}

function filterHoursFrom(minHour: string) {
  return hourOptions.filter((hour) => Number(hour) >= Number(minHour))
}

function filterMinutesFrom(minMinute: string) {
  return minuteOptions.filter((minute) => Number(minute) >= Number(minute))
}

function clampStartDateTime() {
  const now = getNowParts()
  if (createEventForm.value.startDate < now.date) {
    createEventForm.value.startDate = now.date
  }

  if (createEventForm.value.startDate === now.date) {
    if (Number(createEventForm.value.startHour) < Number(now.hour)) {
      createEventForm.value.startHour = now.hour
    }
    if (
      createEventForm.value.startHour === now.hour &&
      Number(createEventForm.value.startMinute) < Number(now.minute)
    ) {
      createEventForm.value.startMinute = now.minute
    }
  }
}

function clampEndDateTime() {
  if (!createEventForm.value.startDate || !createEventForm.value.endDate) return

  if (createEventForm.value.endDate < createEventForm.value.startDate) {
    createEventForm.value.endDate = createEventForm.value.startDate
  }

  if (createEventForm.value.endDate === createEventForm.value.startDate) {
    if (Number(createEventForm.value.endHour) < Number(createEventForm.value.startHour)) {
      createEventForm.value.endHour = createEventForm.value.startHour
    }
    if (
      createEventForm.value.endHour === createEventForm.value.startHour &&
      Number(createEventForm.value.endMinute) < Number(createEventForm.value.startMinute)
    ) {
      createEventForm.value.endMinute = createEventForm.value.startMinute
    }
  }
}

function enforceCreateDateTimeRules() {
  clampStartDateTime()
  clampEndDateTime()
}

const minStartDate = computed(() => {
  const today = getNowParts().date
  if (!editingEventId.value) return today

  const event = homeEvents.value.find((item) => item.id === editingEventId.value)
  if (!event) return today

  const eventStartDate = event.startsAt.slice(0, 10)
  return eventStartDate < today ? eventStartDate : today
})

const availableStartHours = computed(() => {
  const now = getNowParts()
  if (createEventForm.value.startDate > now.date) return hourOptions
  if (createEventForm.value.startDate < now.date) return hourOptions
  return filterHoursFrom(now.hour)
})

const availableStartMinutes = computed(() => {
  const now = getNowParts()
  if (createEventForm.value.startDate > now.date) return minuteOptions
  if (createEventForm.value.startDate < now.date) return minuteOptions
  if (Number(createEventForm.value.startHour) > Number(now.hour)) return minuteOptions
  return filterMinutesFrom(now.minute)
})

const availableEndHours = computed(() => {
  if (!createEventForm.value.endDate) return hourOptions
  if (createEventForm.value.endDate > createEventForm.value.startDate) return hourOptions
  return filterHoursFrom(createEventForm.value.startHour)
})

const availableEndMinutes = computed(() => {
  if (!createEventForm.value.endDate || createEventForm.value.endDate > createEventForm.value.startDate) {
    return minuteOptions
  }
  if (Number(createEventForm.value.endHour) > Number(createEventForm.value.startHour)) return minuteOptions
  return filterMinutesFrom(createEventForm.value.startMinute)
})

const eventStyle = computed(() => ({
  '--theme-start': selectedTheme.value.start,
  '--theme-mid': selectedTheme.value.mid,
  '--theme-end': selectedTheme.value.end,
  '--theme-accent': selectedTheme.value.accent,
  '--theme-ink': selectedTheme.value.ink,
}))

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

const photoViewerUsesAlbum = ref(false)

const flatPhotos = computed(() => {
  if (!selectedPhoto.value) return []

  const event = getEventById(selectedPhoto.value.eventId)
  if (!event) return []

  const photos = photoViewerUsesAlbum.value ? event.photos : getSavedPhotos(event)
  return photos.map((photo) => ({ event, photo }))
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

const startDateTime = computed(() =>
  buildDateTimeFromParts(
    createEventForm.value.startDate,
    createEventForm.value.startHour,
    createEventForm.value.startMinute,
  ),
)

const endDateTime = computed(() =>
  buildDateTimeFromParts(
    createEventForm.value.endDate,
    createEventForm.value.endHour,
    createEventForm.value.endMinute,
  ),
)

const startIsInPast = computed(() => {
  if (editingEventId.value) {
    const existing = homeEvents.value.find((item) => item.id === editingEventId.value)
    if (existing && new Date(existing.startsAt).getTime() <= Date.now()) {
      return false
    }
  }
  return new Date(startDateTime.value).getTime() < Date.now()
})

const endBeforeStart = computed(
  () => new Date(endDateTime.value).getTime() < new Date(startDateTime.value).getTime(),
)

const canSaveEvent = computed(
  () =>
    Boolean(createEventForm.value.title.trim()) &&
    Boolean(createEventForm.value.startDate) &&
    Boolean(createEventForm.value.endDate) &&
    !startIsInPast.value &&
    !endBeforeStart.value,
)

watch(
  () => [
    createEventForm.value.startDate,
    createEventForm.value.startHour,
    createEventForm.value.startMinute,
  ],
  () => {
    clampStartDateTime()
    clampEndDateTime()
  },
)

watch(
  () => [
    createEventForm.value.endDate,
    createEventForm.value.endHour,
    createEventForm.value.endMinute,
  ],
  () => {
    clampEndDateTime()
  },
)

const selectedAutomaticTemplates = computed(() =>
  achievementTemplates.value.filter(
    (template) =>
      template.scope === 'automatic' &&
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

const previewDateLabel = computed(() => formatEventDateLabel(startDateTime.value))
const previewTimezoneLabel = computed(() => formatTimezoneLabel(createEventForm.value.timezone))

const createPaymentEnabled = computed(
  () =>
    createEventForm.value.paymentEnabled ||
    Boolean(
      createEventForm.value.costPerPerson ||
        createEventForm.value.paymentDestination ||
        createEventForm.value.paymentComment,
    ),
)

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

const canWritePhotoComments = computed(() => currentView.value === 'event' && Boolean(activePhotoEntry.value))

function openAuth(mode: AuthMode) {
  authMode.value = mode
  authGuestName.value = currentUser.mode === 'demo' ? '' : currentUser.name
  authEmail.value = currentUser.mode === 'profile' ? currentUser.email ?? '' : ''
  authCode.value = ''
  authEmailCodeRequested.value = false
  authError.value = ''
  authOpen.value = true
}

async function requestAuthCode() {
  authError.value = ''

  try {
    await authService.requestEmailCode(authEmail.value)
    authEmailCodeRequested.value = true
  } catch (error) {
    authError.value = error instanceof Error ? error.message : 'Не удалось подготовить код.'
  }
}

async function completeAuth() {
  authError.value = ''

  try {
    let nextUser: CurrentUser

    if (authMode.value === 'guest') {
      nextUser = await authService.createGuestUser(authGuestName.value)
    } else {
      if (!authEmailCodeRequested.value) {
        await authService.requestEmailCode(authEmail.value)
        authEmailCodeRequested.value = true
      }
      nextUser =
        currentUser.mode === 'guest' || currentUser.mode === 'demo'
          ? await authService.upgradeGuestToProfile(authEmail.value, authCode.value)
          : await authService.verifyEmailCode(authEmail.value, authCode.value)
    }

    applyCurrentUser(nextUser)
    await loadHomeEvents()
    await syncAllEventPhotosFromService()
    await syncAllEventRsvpsFromService()
    await syncAllEventMessagesFromService()
    await syncAllEventAchievementsFromService()
    authOpen.value = false
    profileMenuOpen.value = false
    notificationsOpen.value = false
    await resolveInviteFlow()
    if (currentView.value !== 'event') {
      currentView.value = 'home'
    }
  } catch (error) {
    authError.value = error instanceof Error ? error.message : 'Не удалось выполнить вход.'
  }
}

async function logout() {
  await authService.logout()
  applyCurrentUser(buildRuntimeDemoUser())
  await loadHomeEvents()
  await syncAllEventPhotosFromService()
  await syncAllEventRsvpsFromService()
  await syncAllEventMessagesFromService()
  await syncAllEventAchievementsFromService()
  currentView.value = 'landing'
  profileMenuOpen.value = false
  notificationsOpen.value = false
  selectedPhoto.value = null
  createEventOpen.value = false
  medalBuilderOpen.value = false
  activeEventId.value = null
  previewDraftEvent.value = null
  coverPickerOpen.value = false
  createAchievementPopover.value = null
  authCode.value = ''
  authEmail.value = ''
  authGuestName.value = ''
  authEmailCodeRequested.value = false
  authError.value = ''
  pendingInviteCode.value = null
  pendingInviteEventId.value = null
  inviteErrorMessage.value = ''
  inviteLinkStatus.value = ''
  replaceInviteCodeInUrl(null)
}

function toggleNotifications() {
  notificationsOpen.value = !notificationsOpen.value
  if (notificationsOpen.value) {
    profileMenuOpen.value = false
  }
}

function toggleProfileMenu() {
  profileMenuOpen.value = !profileMenuOpen.value
  if (profileMenuOpen.value) {
    notificationsOpen.value = false
  }
}

function openProfileEditor(focus: 'name' | 'avatar' = 'name') {
  profileEditorName.value = currentUser.displayName?.trim() || ''
  profileEditorAvatarUrl.value = currentUser.avatarUrl ?? null
  profileEditorError.value = ''
  profileEditorOpen.value = true
  profileMenuOpen.value = false

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
  profileEditorAvatarUrl.value = null
  if (profileAvatarInput.value) {
    profileAvatarInput.value.value = ''
  }
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
      } else {
        reject(new Error('Не удалось прочитать изображение.'))
      }
    }
    reader.onerror = () => reject(new Error('Не удалось прочитать изображение.'))
    reader.readAsDataURL(file)
  })
}

function clearPendingEventVisualFiles() {
  uploadedCoverFile.value = null
  uploadedBackgroundFile.value = null
}

async function handleProfileAvatarUpload(nativeEvent: Event) {
  const input = nativeEvent.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  const allowedTypes = ['image/png', 'image/jpeg', 'image/webp']
  if (!allowedTypes.includes(file.type)) {
    profileEditorError.value = 'Поддерживаются PNG, JPEG и WEBP.'
    input.value = ''
    return
  }

  if (file.size > 2 * 1024 * 1024) {
    profileEditorError.value = 'Файл аватара должен быть не больше 2 МБ.'
    input.value = ''
    return
  }

  try {
    profileEditorAvatarUrl.value = await readFileAsDataUrl(file)
    profileEditorError.value = ''
  } catch (error) {
    profileEditorError.value =
      error instanceof Error ? error.message : 'Не удалось загрузить изображение.'
  } finally {
    input.value = ''
  }
}

async function syncParticipantNameAfterProfileChange(previousName: string, nextName: string) {
  if (
    !currentParticipant.value ||
    !nextName.trim() ||
    (currentParticipant.value.displayName &&
      currentParticipant.value.displayName !== previousName &&
      currentParticipant.value.displayName.trim() !== '')
  ) {
    return
  }

  const updatedParticipant = await participantService.updateParticipantDisplayName(
    currentParticipant.value.id,
    nextName.trim(),
  )
  currentParticipant.value = updatedParticipant
}

async function saveProfileEditor() {
  profileEditorError.value = ''

  try {
    const previousName = currentUser.name
    const nextUser = await authService.updateCurrentUserProfile({
      displayName: profileEditorName.value,
      avatarUrl: profileEditorAvatarUrl.value ?? undefined,
    })
    applyCurrentUser(nextUser)
    await syncParticipantNameAfterProfileChange(previousName, nextUser.displayName?.trim() || '')
    closeProfileEditor()
  } catch (error) {
    profileEditorError.value =
      error instanceof Error ? error.message : 'Не удалось сохранить профиль.'
  }
}

function openCreateEvent() {
  createEventForm.value = createEmptyEventForm()
  clearPendingEventVisualFiles()
  medalForm.value = createEmptyMedalForm()
  applyBackgroundColor(createEventForm.value.backgroundColor)
  enforceCreateDateTimeRules()
  currentView.value = 'create'
  createEventOpen.value = true
  medalBuilderOpen.value = false
  activeEventId.value = null
  previewDraftEvent.value = null
  coverPickerOpen.value = false
  coverPickerTab.value = 'posters'
  coverSearchQuery.value = ''
  emojiPickerOpen.value = false
  createAchievementPopover.value = null
  notificationsOpen.value = false
  profileMenuOpen.value = false
  inviteLinkStatus.value = ''
  replaceInviteCodeInUrl(null)
}

function closeCreateEvent() {
  currentView.value = 'home'
  createEventOpen.value = false
  clearPendingEventVisualFiles()
  medalBuilderOpen.value = false
  activeEventId.value = null
  previewDraftEvent.value = null
  editingEventId.value = null
  coverPickerOpen.value = false
  createAchievementPopover.value = null
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

function openEventPage(eventId: string, eventOverride?: GalleryEvent | null) {
  const event = eventOverride ?? getEventById(eventId)
  replaceInviteCodeInUrl(event?.inviteCode ?? pendingInviteCode.value ?? null)
  activeEventId.value = eventId
  void syncEventRsvpsFromService(eventId)
  void syncEventMessagesFromService(eventId)
  void syncEventPhotosFromService(eventId)
  void syncEventAchievementsFromService(eventId)
  currentView.value = 'event'
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
  eventChatDraft.value = ''
  pendingInviteEventId.value = null
  inviteLinkStatus.value = ''
  replaceInviteCodeInUrl(null)
  closeRsvpSheet()
}

function addInfoBlock() {
  createEventForm.value.infoBlocks.push(createEmptyInfoBlock())
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

async function syncEventPhotosFromService(eventId: string) {
  const event = getEventById(eventId)
  if (!event) return null

  const photos = await photoService.getEventPhotos(eventId, currentUser.id)
  const nextEvent = {
    ...event,
    photos,
  }
  syncEventSavedCount(nextEvent)
  eventService.cacheEventState(nextEvent)
  await loadHomeEvents()
  return nextEvent
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
  eventService.cacheEventState(nextEvent)
  await loadHomeEvents()
  return nextEvent
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
  eventService.cacheEventState(nextEvent)
  await loadHomeEvents()
  return nextEvent
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
  eventService.cacheEventState(nextEvent)
  await loadHomeEvents()
  return nextEvent
}

async function syncAllEventAchievementsFromService() {
  for (const event of homeEvents.value) {
    await syncEventAchievementsFromService(event.id)
  }
}

async function persistEventAchievementsSelection(eventId: string) {
  const existingAchievements = await achievementService.getEventAchievements(eventId)
  for (const achievement of existingAchievements) {
    await achievementService.unselectAchievement(achievement.id)
  }

  for (const template of selectedAutomaticTemplates.value) {
    await achievementService.selectAchievement({
      eventId,
      templateId: template.id,
      scope: 'automatic',
      title: template.title,
      description: template.description,
      icon: template.icon,
      tone: template.tone,
      points: template.points,
      createdBy: currentUser.id,
    })
  }

  for (const template of [...selectedPersonalTemplates.value, ...selectedGroupTemplates.value]) {
    await achievementService.selectAchievement({
      eventId,
      templateId: template.id,
      scope: template.scope,
      title: template.title,
      description: template.description,
      icon: template.icon,
      tone: template.tone,
      points: template.points,
      createdBy: currentUser.id,
    })
  }

  return syncEventAchievementsFromService(eventId)
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
  return event.organizerId === currentUser.id ||
    (!event.organizerId && event.role === 'Организатор' && event.organizerName === currentUser.name)
    ? 'organizer'
    : 'guest'
}

async function ensureCurrentParticipant(event: GalleryEvent | null) {
  if (!event || !currentUser.id || (isAppwriteMode() && !hasRealAuthenticatedUser())) {
    currentParticipant.value = null
    return null
  }

  // Participant is the access/link between a user and an event.
  // RSVP is a separate response and must not remove the participant record.
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

function getRsvpEntryDisplayName(entry: EventRsvpEntry) {
  return entry.displayName || entry.userName || 'Гость'
}

function getRsvpEntryInitials(entry: EventRsvpEntry) {
  return entry.userInitials || buildUserInitials(getRsvpEntryDisplayName(entry))
}

function getMessageAuthorInitials(message: EventChatMessage) {
  return message.authorInitials || buildUserInitials(message.authorName)
}

function isCurrentUserOrganizer(event: GalleryEvent | null) {
  if (!event) return false

  return (
    currentParticipant.value?.role === 'organizer' ||
    event.organizerId === currentUser.id ||
    (event.role === 'Организатор' && event.organizerName === currentUser.name)
  )
}

async function loadSelectedPhotoComments(photoId: string) {
  selectedPhotoComments.value = await photoCommentService.getPhotoComments(photoId)
}

async function sendEventChatMessage() {
  const event = activeEvent.value
  const text = eventChatDraft.value.trim()
  if (!event || !text) return

  const participant = currentParticipant.value ?? (await ensureCurrentParticipant(event))
  if (!participant) return

  const nextMessage = await chatService.addEventMessage({
    eventId: event.id,
    userId: currentUser.id,
    participantId: participant.id,
    authorName: participant.displayName,
    authorAvatarUrl: currentUser.avatarUrl,
    text,
  })

  await updateEventInList(event.id, (current) => ({
    ...current,
    chatMessages: [...current.chatMessages, nextMessage],
  }))
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
  photoViewerUsesAlbum.value = useAlbum
  selectedPhoto.value = { eventId: event.id, photoId: photo.id }
  photoCommentDraft.value = ''
  photoCommentError.value = ''
  void loadSelectedPhotoComments(photo.id)
}

function closePhoto() {
  selectedPhoto.value = null
  photoViewerUsesAlbum.value = false
  selectedPhotoComments.value = []
  photoCommentDraft.value = ''
  photoCommentError.value = ''
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
  photoCommentDraft.value = ''
  photoCommentError.value = ''
  void loadSelectedPhotoComments(next.photo.id)
}

async function submitPhotoComment() {
  const activeEntry = activePhotoEntry.value
  if (!activeEntry || currentView.value !== 'event') return

  const participant =
    currentParticipant.value?.eventId === activeEntry.event.id
      ? currentParticipant.value
      : await ensureCurrentParticipant(activeEntry.event)
  if (!participant) return

  try {
    photoCommentError.value = ''
    const nextComment = await photoCommentService.addPhotoComment({
      photoId: activeEntry.photo.id,
      eventId: activeEntry.event.id,
      userId: currentUser.id,
      participantId: participant.id,
      authorName: participant.displayName,
      authorAvatarUrl: currentUser.avatarUrl,
      text: photoCommentDraft.value,
    })

    selectedPhotoComments.value = [...selectedPhotoComments.value, nextComment]
    photoCommentDraft.value = ''
  } catch (error) {
    photoCommentError.value =
      error instanceof Error ? error.message : 'Не удалось добавить комментарий.'
  }
}

function getAchievementKey(event: GalleryEvent, achievement: EventAchievement) {
  return `${event.id}-${achievement.id}`
}

function toggleAchievement(event: GalleryEvent, achievement: EventAchievement) {
  const key = getAchievementKey(event, achievement)
  activeAchievement.value = activeAchievement.value === key ? null : key
}

function countAchievements(event: GalleryEvent, scope: AchievementScope) {
  return event.achievements.filter((achievement) => achievement.scope === scope).length
}

function toggleAutomaticTemplate(templateId: string) {
  const nextIds = new Set(createEventForm.value.automaticTemplateIds)
  if (nextIds.has(templateId)) {
    nextIds.delete(templateId)
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

function toggleCreateAchievementPopover(key: string) {
  createAchievementPopover.value = createAchievementPopover.value === key ? null : key
}

function getCreateAchievementKey(scope: string, templateId: string) {
  return `${scope}-${templateId}`
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
  if (createAchievementPopover.value?.endsWith(templateId)) {
    createAchievementPopover.value = null
  }
}

function getTitleStyleClass(styleId: string) {
  return `title-style-${styleId}`
}

function getRsvpStyleOption(styleId: string) {
  return rsvpStyleOptions.find((option) => option.id === styleId) ?? rsvpStyleOptions[0]
}

function getRsvpPreviewSymbols(styleId: string) {
  const symbolMap: Record<string, [string, string, string]> = {
    bloom: ['🌷', '🌼', '🥀'],
    flirty: ['😘', '💋', '🥵'],
    hearts: ['💖', '🫶', '💔'],
    icons: ['✓', '?', '×'],
  }

  return symbolMap[styleId] ?? symbolMap.icons
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
  return infoBlockTypeOptions.find((option) => option.value === block.type)?.label ?? block.title
}

function findAssetIdBySrc(list: AssetOption[], src: string) {
  return list.find((asset) => asset.src === src)?.id ?? ''
}

function openRsvpSheet(status: RsvpStatus) {
  if (currentView.value !== 'event' || !activeEvent.value) return
  rsvpSheetStatus.value = status
  rsvpSheetMessage.value = ''
  rsvpSheetOpen.value = true
}

function closeRsvpSheet() {
  rsvpSheetOpen.value = false
  rsvpSheetStatus.value = null
  rsvpSheetMessage.value = ''
}

async function submitRsvpResponse() {
  const event = activeEvent.value
  const status = rsvpSheetStatus.value
  if (!event || !status) return

  const participant = currentParticipant.value ?? (await ensureCurrentParticipant(event))
  if (!participant) return

  const message = rsvpSheetMessage.value.trim()
  const statusLabel = rsvpStatusLabels[status]
  const chatText = message
    ? `${participant.displayName} отметил(а) «${statusLabel}»: ${message}`
    : `${participant.displayName} отметил(а) «${statusLabel}».`

  const nextRsvp = await rsvpService.setParticipantRsvp({
    eventId: event.id,
    userId: currentUser.id,
    participantId: participant.id,
    displayName: participant.displayName,
    avatarUrl: currentUser.avatarUrl,
    status,
    message: message || undefined,
  })

  const nextMessage = await chatService.addEventMessage({
    eventId: event.id,
    userId: currentUser.id,
    participantId: participant.id,
    authorName: participant.displayName,
    authorAvatarUrl: currentUser.avatarUrl,
    text: chatText,
  })

  await updateEventInList(event.id, (current) => ({
    ...current,
    guestRsvps: [
      ...current.guestRsvps.filter((entry) => entry.id !== nextRsvp.id),
      nextRsvp,
    ],
    chatMessages: [...current.chatMessages, nextMessage],
  }))

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

  const imageUrl = await readFileAsDataUrl(file)
  const photo = await photoService.addEventPhoto({
    eventId,
    userId: currentUser.id,
    participantId: participant.id,
    authorName: participant.displayName,
    authorAvatarUrl: currentUser.avatarUrl,
    imageUrl,
  })

  const photoChatMessage =
    source === 'chat'
      ? await chatService.addEventMessage({
          eventId,
          userId: currentUser.id,
          participantId: participant.id,
          authorName: participant.displayName,
          authorAvatarUrl: currentUser.avatarUrl,
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
    rsvpStyle: event.rsvpStyle ?? 'icons',
    automaticTemplateIds: achievementTemplates.value
      .filter((template) => event.achievements.some((achievement) => achievement.title === template.title))
      .filter((template) => template.scope === 'automatic')
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
  }
}

async function openEditEvent(eventId: string) {
  const event = getEventById(eventId)
  if (!event || event.role !== 'Организатор') return

  await syncEventAchievementsFromService(eventId)
  editingEventId.value = eventId
  populateFormFromEvent(getEventById(eventId) ?? event)
  enforceCreateDateTimeRules()
  currentView.value = 'create'
  medalBuilderOpen.value = false
  coverPickerOpen.value = false
  previewDraftEvent.value = null
}

function scrollToCreateSection(sectionId: string) {
  document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
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
  const hostName = createEventForm.value.hostAlias.trim() || currentUser.name
  const hostInitials =
    hostName
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part.slice(0, 1))
      .join('')
      .slice(0, 2)
      .toUpperCase() || currentUser.initials
  const automaticAchievements = selectedAutomaticTemplates.value.map((template) =>
    buildAchievementFromTemplate(template),
  )
  const selectedTemplates = [...selectedPersonalTemplates.value, ...selectedGroupTemplates.value].map(
    (template) => buildAchievementFromTemplate(template),
  )
  const payment =
    createPaymentEnabled.value &&
    (createEventForm.value.costPerPerson ||
      createEventForm.value.paymentDestination ||
      createEventForm.value.paymentComment)
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
    title: createEventForm.value.title.trim(),
    status: buildEventStatus(safeStartsAt, safeEndsAt),
    startsAt: safeStartsAt,
    endsAt: safeEndsAt,
    role: currentUser.role,
    organizerId: currentUser.id,
    organizerName: hostName,
    organizerInitials: hostInitials,
    organizerTone: '#ffd166,#41d3bd',
    organizerAvatarSrc: undefined,
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
  }

  return newEvent
}

async function persistEventVisualUploads(event: GalleryEvent, existingEvent?: GalleryEvent) {
  if (!isAppwriteMode()) {
    return event
  }

  const nextEvent: GalleryEvent = {
    ...event,
    coverFileId: existingEvent?.coverFileId,
    backgroundFileId: existingEvent?.backgroundFileId,
  }

  if (uploadedCoverFile.value) {
    const uploadedCover = await storageService.uploadEventVisual(uploadedCoverFile.value, 'cover')
    nextEvent.coverFileId = uploadedCover.fileId
    nextEvent.coverStart = uploadedCover.previewUrl
    nextEvent.coverEnd = uploadedCover.previewUrl
  } else if (!createEventForm.value.uploadedCoverUrl) {
    nextEvent.coverFileId = undefined
  }

  if (createEventForm.value.backgroundMode === 'color') {
    nextEvent.backgroundFileId = undefined
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
    nextEvent.backgroundMediaType = getBackgroundMediaTypeFromFile(uploadedBackgroundFile.value)
    nextEvent.backgroundStart = uploadedBackground.previewUrl
    nextEvent.backgroundEnd = uploadedBackground.previewUrl
  } else if (!createEventForm.value.uploadedBackgroundUrl) {
    nextEvent.backgroundFileId = undefined
  }

  return nextEvent
}

async function saveEvent() {
  enforceCreateDateTimeRules()
  if (!canSaveEvent.value) return

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
    await participantService.joinEventAsParticipant(updated.id, updated.organizerName, 'organizer')
    await persistEventAchievementsSelection(updated.id)
    await loadHomeEvents()
    const refreshedEvent = await eventService.getEventById(updated.id)
    if (refreshedEvent) {
      upsertHomeEvent(refreshedEvent)
    }
    activeTab.value = updated.status
    editingEventId.value = null
    createEventOpen.value = false
    clearPendingEventVisualFiles()
    medalBuilderOpen.value = false
    coverPickerOpen.value = false
    previewDraftEvent.value = null
    openEventPage(updated.id, refreshedEvent ?? updated)
    notifications.value = [
      {
        id: createId('notice'),
        title: 'Событие обновлено',
        text: `Изменения в «${updated.title}» сохранены.`,
        time: 'сейчас',
      },
      ...notifications.value,
    ]
    return
  }

  let nextEvent = createEventFromForm()
  nextEvent = await persistEventVisualUploads(nextEvent)
  await eventService.createEvent(nextEvent)
  await participantService.joinEventAsParticipant(nextEvent.id, nextEvent.organizerName, 'organizer')
  await persistEventAchievementsSelection(nextEvent.id)
  await loadHomeEvents()
  const refreshedEvent = await eventService.getEventById(nextEvent.id)
  if (refreshedEvent) {
    upsertHomeEvent(refreshedEvent)
  }
  expandedEvents.value = new Set()
  activeTab.value = nextEvent.status
  activeAchievement.value = null
  createEventOpen.value = false
  clearPendingEventVisualFiles()
  medalBuilderOpen.value = false
  coverPickerOpen.value = false
  previewDraftEvent.value = null
  openEventPage(nextEvent.id, refreshedEvent ?? nextEvent)
  notifications.value = [
    {
      id: createId('notice'),
      title: 'Событие создано',
      text: `Новое событие "${nextEvent.title}" добавлено в ваш Home.`,
      time: 'сейчас',
    },
    ...notifications.value,
  ]
}
</script>

<template>
  <main v-if="currentView === 'landing'" class="app-shell" :style="eventStyle">
    <header class="topbar" aria-label="Основная навигация">
      <a class="brand" href="#" aria-label="Event Gallery">
        <span class="brand-mark">EG</span>
        <span>Event Gallery</span>
      </a>

      <nav class="nav-links" aria-label="Разделы главной страницы">
        <a href="#flow">Сценарий</a>
        <a href="#custom">Кастомность</a>
        <a href="#gallery">Галерея</a>
      </nav>

      <div class="topbar-actions">
        <button class="ghost-button" type="button" @click="openAuth('profile')">Войти</button>
        <button class="primary-button compact" type="button" @click="openAuth('guest')">
          Создать событие
        </button>
      </div>
    </header>

    <section class="hero" aria-labelledby="hero-title">
      <div class="hero-scene" aria-hidden="true">
        <article class="event-poster poster-main">
          <div class="poster-cover">
            <span class="poster-date">24 мая</span>
            <span class="poster-emoji">{{ selectedTheme.emoji }}</span>
          </div>
          <div class="poster-body">
            <p class="eyebrow">Событие</p>
            <h2>Фото-вечер у кампуса</h2>
            <div class="poster-meta">
              <span>18 гостей</span>
              <span>126 фото</span>
              <span>+420 очков</span>
            </div>
          </div>
        </article>

        <div class="photo-stack stack-left">
          <span class="mock-photo tall"></span>
          <span class="mock-photo"></span>
          <span class="mock-photo dark"></span>
        </div>

        <div class="quick-panel">
          <span class="quick-title">QR-доступ</span>
          <span class="qr-grid"></span>
          <span class="quick-code">MAY-24</span>
        </div>

        <div class="badge-cloud">
          <span>Первый кадр</span>
          <span>Фото вечера</span>
          <span>Топ-3</span>
        </div>
      </div>

      <div class="hero-content">
        <p class="hero-label">Дипломный проект · MVP</p>
        <h1 id="hero-title">События, фото и воспоминания в одном месте</h1>
        <p class="hero-text">
          Участники заходят по ссылке или QR-коду, загружают снимки, получают очки и
          сохраняют лучшие моменты в персональной галерее.
        </p>

        <div class="hero-actions">
          <button class="primary-button" type="button" @click="openAuth('guest')">
            Создать событие
          </button>
          <button class="secondary-button" type="button" @click="openAuth('guest')">
            Войти по коду
          </button>
        </div>
      </div>
    </section>

    <section v-if="inviteErrorMessage" class="invite-alert" aria-live="polite">
      <strong>Не удалось открыть приглашение</strong>
      <p>{{ inviteErrorMessage }}</p>
    </section>

    <section id="flow" class="flow-section" aria-labelledby="flow-title">
      <div class="section-heading">
        <p class="eyebrow">Основной сценарий</p>
        <h2 id="flow-title">Короткий путь от события до галереи</h2>
      </div>

      <div class="flow-grid">
        <article class="flow-card">
          <span class="step-number">01</span>
          <h3>Создать событие</h3>
          <p>Название, дата, описание и визуальная тема без сложной настройки.</p>
        </article>
        <article class="flow-card">
          <span class="step-number">02</span>
          <h3>Пригласить гостей</h3>
          <p>Ссылка и QR-код подходят для чата, распечатки или экрана на мероприятии.</p>
        </article>
        <article class="flow-card">
          <span class="step-number">03</span>
          <h3>Собрать фото</h3>
          <p>Общий альбом, личная галерея, лайки, очки и достижения участников.</p>
        </article>
      </div>
    </section>

    <section id="custom" class="studio-section" aria-labelledby="custom-title">
      <div class="custom-copy">
        <p class="eyebrow">Простота + настройка</p>
        <h2 id="custom-title">У события должен быть свой характер</h2>
        <p>
          В первой версии достаточно тем, обложки, бейджей и mock-photo карточек. Это
          показывает кастомность, но не перегружает дипломный MVP.
        </p>

        <div class="theme-switcher" aria-label="Выбор темы события">
          <button
            v-for="theme in themes"
            :key="theme.id"
            class="theme-chip"
            :class="{ active: theme.id === selectedTheme.id }"
            type="button"
            @click="selectedTheme = theme"
          >
            <span class="theme-dot" :style="{ background: theme.accent }"></span>
            {{ theme.name }}
          </button>
        </div>
      </div>

      <article class="studio-preview">
        <div class="preview-toolbar">
          <span>{{ selectedTheme.name }}</span>
          <strong>{{ selectedTheme.mood }}</strong>
        </div>
        <div class="preview-grid">
          <span class="preview-photo large"></span>
          <span class="preview-photo"></span>
          <span class="preview-photo alt"></span>
          <span class="preview-photo soft"></span>
        </div>
        <div class="preview-footer">
          <span>126 фото</span>
          <span>18 участников</span>
          <span>7 достижений</span>
        </div>
      </article>
    </section>

    <section id="gallery" class="feature-strip" aria-label="Ключевые возможности MVP">
      <article>
        <span class="feature-icon">♡</span>
        <h3>Лайки и бейджи</h3>
        <p>Лучшие фото получают визуальные отметки прямо в интерфейсе.</p>
      </article>
      <article>
        <span class="feature-icon">★</span>
        <h3>Очки активности</h3>
        <p>Участники видят вклад в альбом и мягко соревнуются друг с другом.</p>
      </article>
      <article>
        <span class="feature-icon">⌁</span>
        <h3>Демо-режим</h3>
        <p>На защите главные экраны можно показать даже без серверной части.</p>
      </article>
    </section>

    <section class="final-cta" aria-labelledby="cta-title">
      <h2 id="cta-title">Готово для первого дипломного прототипа</h2>
      <button class="primary-button" type="button" @click="openAuth('guest')">
        Открыть окно входа
      </button>
    </section>
  </main>

  <main v-else-if="currentView === 'home'" class="home-shell">
    <header class="home-topbar" aria-label="Навигация личного кабинета">
      <a class="brand home-brand" href="#" aria-label="Event Gallery Home">
        <span class="brand-mark">EG</span>
        <span>Event Gallery</span>
      </a>

      <div class="home-actions">
        <button class="home-icon-button" type="button" @click="toggleNotifications">
          <span class="notification-dot"></span>
          Уведомления
        </button>
        <button class="primary-button compact" type="button" @click="openCreateEvent">
          Создать событие
        </button>
        <button class="profile-button" type="button" @click="toggleProfileMenu">
          <span class="profile-avatar" :class="{ filled: Boolean(currentUser.avatarUrl) }" :style="getAvatarStyle(currentUser.avatarUrl)">
            {{ currentUser.avatarUrl ? '' : currentUser.initials }}
          </span>
          <span>{{ currentUser.name }}</span>
        </button>
      </div>

      <section v-if="notificationsOpen" class="notifications-popover" aria-label="Уведомления">
        <div class="popover-head">
          <strong>Уведомления</strong>
          <span>{{ notifications.length }} новых</span>
        </div>
        <article v-for="item in notifications" :key="item.id" class="notice-item">
          <span>{{ item.time }}</span>
          <strong>{{ item.title }}</strong>
          <p>{{ item.text }}</p>
        </article>
      </section>

      <section v-if="profileMenuOpen" class="profile-popover" aria-label="Меню профиля">
        <button type="button" @click="openProfileEditor('name')">Изменить имя</button>
        <button type="button" @click="openProfileEditor('avatar')">Изменить аватар</button>
        <button type="button" @click="logout">Выйти</button>
      </section>
    </header>

    <section class="home-workspace" aria-labelledby="events-title">
      <div class="home-section-head">
        <div>
          <p class="eyebrow">Личная галерея</p>
          <h1 id="events-title">Мои события</h1>
        </div>
        <button
          v-if="expandableVisibleEvents.length"
          class="secondary-button"
          type="button"
          @click="toggleAllEvents"
        >
          {{ allVisibleExpanded ? 'Свернуть галерею' : 'Раскрыть сохранённые фото' }}
        </button>
      </div>

      <section v-if="inviteErrorMessage" class="invite-alert invite-alert-dark" aria-live="polite">
        <strong>Ссылка приглашения не сработала</strong>
        <p>{{ inviteErrorMessage }}</p>
      </section>

      <div class="event-tabs" aria-label="Фильтр событий">
        <button
          type="button"
          class="event-tab"
          :class="{ active: activeTab === 'current' }"
          @click="setActiveTab('current')"
        >
          Текущие
        </button>
        <button
          type="button"
          class="event-tab"
          :class="{ active: activeTab === 'upcoming' }"
          @click="setActiveTab('upcoming')"
        >
          Будущие
        </button>
        <button
          type="button"
          class="event-tab"
          :class="{ active: activeTab === 'past' }"
          @click="setActiveTab('past')"
        >
          Прошедшие
        </button>
      </div>

      <section class="event-mosaic" aria-label="События в личной галерее">
        <article
          v-for="event in visibleEvents"
          :key="event.id"
          class="home-event-card"
          :class="{ expanded: isEventExpanded(event.id) }"
          :style="{ '--event-accent': event.accent, '--organizer-tone': event.organizerTone }"
        >
          <div v-if="!isEventExpanded(event.id)" class="event-compact-shell">
            <button
              class="event-compact"
              type="button"
              :style="getEventSurfaceStyle(event.coverStart, event.coverEnd)"
              @click="openEventPage(event.id)"
            >
              <span class="event-role">{{ event.role }}</span>
              <span class="event-date">{{ formatShortEventDate(event.startsAt) }}</span>
              <span class="event-compact-title">{{ event.title }}</span>
              <span class="event-organizer">
                <span class="organizer-avatar">{{ event.organizerInitials }}</span>
                {{ event.organizerName }}
              </span>
            </button>
            <button
              v-if="canExpandOnHome(event)"
              class="event-expand-button"
              type="button"
              @click.stop="toggleEventExpanded(event.id)"
            >
              Раскрыть
            </button>
          </div>

          <div v-else class="event-expanded" :style="getEventSurfaceStyle(event.backgroundStart, event.backgroundEnd)">
            <video
              v-if="isVideoBackground(event)"
              class="event-expanded-video"
              :src="event.backgroundStart"
              autoplay
              muted
              loop
              playsinline
            ></video>
            <div v-if="canShowHomeAchievements(event)" class="expanded-achievements" aria-label="Полученные достижения">
              <button
                v-for="achievement in event.achievements"
                :key="achievement.id"
                class="achievement-medal"
                :class="{ active: activeAchievement === getAchievementKey(event, achievement) }"
                :style="{ '--achievement-tone': achievement.tone }"
                type="button"
                @click="toggleAchievement(event, achievement)"
              >
                <span class="achievement-mark">{{ achievement.icon }}</span>
                <span>{{ achievement.title }}</span>
                <span
                  v-if="activeAchievement === getAchievementKey(event, achievement)"
                  class="achievement-popover"
                >
                  {{ achievement.description }}
                </span>
              </button>
            </div>

            <div class="expanded-event-head">
              <div class="expanded-event-copy">
                <div>
                  <span class="event-role">{{ event.role }}</span>
                  <h2>{{ event.title }}</h2>
                  <p>
                    {{ formatEventDateLabel(event.startsAt) }} · {{ event.location }} · организует
                    {{ event.organizerName }}
                  </p>
                </div>
                <div
                  class="expanded-cover-thumb"
                  :style="getEventSurfaceStyle(event.coverStart, event.coverEnd)"
                ></div>
              </div>
              <div class="expanded-event-actions">
                <button class="secondary-button compact-action" type="button" @click="openEventPage(event.id)">
                  Открыть событие
                </button>
                <button class="secondary-button compact-action" type="button" @click="copyInviteLink(event)">
                  Скопировать ссылку
                </button>
                <button class="collapse-event-button" type="button" @click="toggleEventExpanded(event.id)">
                  Свернуть
                </button>
              </div>
            </div>

            <div v-if="getSavedPhotos(event).length" class="event-photo-gallery">
              <button
                v-for="photo in getSavedPhotos(event)"
                :key="photo.id"
                class="gallery-photo"
                :class="{ saved: photo.saved }"
                type="button"
                :style="getPhotoStyle(photo)"
                :aria-label="`Открыть сохранённое фото события ${event.title}`"
                @click="openPhoto(event, photo)"
              ></button>
            </div>
            <div v-else class="event-photo-empty">
              <strong>Сохранённых фото пока нет</strong>
              <p>Откройте событие и сохраните снимки из альбома — они появятся здесь.</p>
            </div>
          </div>
        </article>
      </section>
    </section>
  </main>

  <main
    v-else-if="currentView === 'preview' || currentView === 'event'"
    class="event-page-shell"
    :class="{ 'is-preview': currentView === 'preview' }"
  >
    <div
      v-if="eventPageData"
      class="event-page-background"
      :style="getEventSurfaceStyle(eventPageData.backgroundStart, eventPageData.backgroundEnd)"
    >
      <video
        v-if="isVideoBackground(eventPageData)"
        class="event-page-background-video"
        :src="eventPageData.backgroundStart"
        autoplay
        muted
        loop
        playsinline
      ></video>
    </div>

    <header class="event-page-topbar">
      <a class="brand home-brand" href="#" aria-label="Event Gallery" @click.prevent="currentView === 'preview' ? closeGuestPreview() : closeEventPage()">
        <span class="brand-mark">EG</span>
        <span>Event Gallery</span>
      </a>

      <div v-if="currentView === 'preview'" class="event-page-mode-banner">
        <span>Просмотр события</span>
        <button class="secondary-button compact-action" type="button" @click="closeGuestPreview">Назад</button>
        <button class="primary-button compact-action" type="button" @click="saveEvent">Сохранить событие</button>
      </div>
      <div v-else class="event-page-top-actions">
        <button
          v-if="isCurrentUserOrganizer(activeEvent)"
          class="secondary-button compact-action"
          type="button"
          @click="activeEvent ? openEditEvent(activeEvent.id) : undefined"
        >
          Изменить
        </button>
        <button class="secondary-button compact-action" type="button" @click="closeEventPage">Home</button>
      </div>
    </header>

    <section v-if="eventPageData" class="event-page-stage">
      <div class="event-page-layout">
        <div class="event-page-main">
          <h1 class="event-page-title" :class="getTitleStyleClass(eventPageData.titleStyle || 'classic')">
            {{ eventPageData.title }}
          </h1>
          <p class="event-page-meta">
            {{ formatEventDateLabel(eventPageData.startsAt) }}
            <span v-if="eventPageData.timezoneLabel"> · {{ eventPageData.timezoneLabel }}</span>
          </p>
          <p class="event-page-location">📍 {{ eventPageData.location }}</p>
          <div class="event-page-host">
            <span class="organizer-avatar">{{ eventPageData.organizerInitials }}</span>
            <span>Проводит {{ eventPageData.organizerName }}</span>
          </div>
          <p v-if="eventPageData.description" class="event-page-description">{{ eventPageData.description }}</p>

          <section v-if="currentView !== 'preview'" class="event-page-section event-page-invite-card">
            <div class="event-page-section-head">
              <strong>Приглашение</strong>
              <button class="secondary-button compact-action" type="button" @click="copyInviteLink(eventPageData)">
                Скопировать ссылку
              </button>
            </div>
            <p class="event-page-section-copy">
              Код приглашения: <strong>{{ eventPageData.inviteCode }}</strong>
            </p>
            <code class="event-invite-link">{{ getEventInviteUrl(eventPageData) }}</code>
            <p v-if="inviteLinkStatus" class="event-invite-status">{{ inviteLinkStatus }}</p>
          </section>

          <ul v-if="eventPageData.infoBlocks?.length" class="event-info-list">
            <li v-for="block in eventPageData.infoBlocks" :key="block.id" class="event-info-item">
              <span class="event-info-icon">{{ block.icon }}</span>
              <div class="event-info-copy">
                <strong>{{ getInfoBlockLabel(block) }}</strong>
                <a
                  v-if="block.link"
                  class="event-info-link"
                  :href="block.link"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {{ block.link }}
                </a>
                <p v-if="block.description">{{ block.description }}</p>
              </div>
            </li>
          </ul>

          <section v-if="currentView === 'preview'" class="event-page-section">
            <div class="event-page-section-head">
              <strong>Guest List</strong>
              <span class="event-page-section-note">Пример для preview</span>
            </div>
            <p class="event-page-section-copy">3 Going · 1 Maybe</p>
          </section>

          <template v-else>
            <section class="event-page-section">
              <div class="event-page-section-head">
                <strong>Guest List</strong>
              </div>
              <p class="event-page-section-copy">
                {{ getRsvpSummary(eventPageData).going }} пойдут ·
                {{ getRsvpSummary(eventPageData).maybe }} возможно ·
                {{ getRsvpSummary(eventPageData).cant }} не смогут
              </p>
              <div class="event-page-avatar-row">
                <span
                  v-for="entry in eventPageData.guestRsvps.slice(0, 6)"
                  :key="entry.id"
                  class="guest-avatar-chip"
                  :title="`${getRsvpEntryDisplayName(entry)}: ${rsvpStatusLabels[entry.status]}`"
                >
                  {{ getRsvpEntryInitials(entry) }}
                </span>
              </div>
            </section>

            <section class="event-page-section">
              <div class="event-page-section-head">
                <strong>Photo Album</strong>
                <span>{{ eventPageData.photos.length }} фото</span>
              </div>
              <div class="event-album-grid">
                <button
                  class="event-album-add-tile"
                  type="button"
                  aria-label="Добавить фото из файлов"
                  @click="triggerAlbumPhotoPicker(eventPageData.id)"
                >
                  <span class="event-album-add-icon">+</span>
                  <span>Добавить фото</span>
                </button>
                <article v-for="photo in eventPageData.photos" :key="photo.id" class="event-album-item">
                  <button
                    class="event-album-photo"
                    type="button"
                    :style="getPhotoStyle(photo)"
                    :aria-label="`Открыть фото ${eventPageData.title}`"
                    @click="openPhoto(eventPageData, photo, true)"
                  ></button>
                  <button
                    class="event-save-photo-button"
                    :class="{ active: photo.saved }"
                    type="button"
                    @click="togglePhotoSaved(eventPageData.id, photo.id)"
                  >
                    {{ photo.saved ? 'В сохранённых' : 'Сохранить' }}
                  </button>
                </article>
              </div>
            </section>

            <section class="event-page-section">
              <div class="event-page-section-head">
                <strong>Activity</strong>
                <span>{{ eventPageData.chatMessages.length }} updates</span>
              </div>
              <div class="event-chat-feed">
                <article v-for="message in eventPageData.chatMessages" :key="message.id" class="event-chat-item">
                  <span class="guest-avatar-chip">{{ getMessageAuthorInitials(message) }}</span>
                  <div class="event-chat-copy">
                    <strong>{{ message.authorName }}</strong>
                    <p>{{ message.text }}</p>
                    <button
                      v-if="
                        getEventPhotoById(eventPageData, message.photoId) &&
                        getPhotoImageSource(getEventPhotoById(eventPageData, message.photoId)!)
                      "
                      class="event-chat-photo-link"
                      type="button"
                      @click="
                        openPhoto(
                          eventPageData,
                          getEventPhotoById(eventPageData, message.photoId)!,
                          true,
                        )
                      "
                    >
                      <img
                        :src="getPhotoImageSource(getEventPhotoById(eventPageData, message.photoId)!)"
                        alt="Фото из чата"
                        decoding="async"
                      />
                    </button>
                  </div>
                </article>
              </div>
              <form class="event-chat-composer" @submit.prevent="sendEventChatMessage">
                <button
                  class="event-attach-button"
                  type="button"
                  aria-label="Прикрепить фото"
                  @click="triggerChatPhotoPicker"
                >
                  📎
                </button>
                <input v-model="eventChatDraft" type="text" placeholder="Написать в чат события..." />
                <button class="primary-button compact-action" type="submit">Отправить</button>
              </form>
            </section>
          </template>
        </div>

        <aside class="event-page-side">
          <div class="event-page-poster">
            <img
              v-if="isAssetSource(eventPageData.coverStart)"
              :src="eventPageData.coverStart"
              :alt="eventPageData.title"
              decoding="async"
            />
            <div
              v-else
              class="event-page-poster-fallback"
              :style="getEventSurfaceStyle(eventPageData.coverStart, eventPageData.coverEnd)"
            ></div>
          </div>

          <div class="rsvp-action-list" :data-style="eventPageData.rsvpStyle || 'icons'">
            <button
              v-for="choice in getRsvpChoices(eventPageData.rsvpStyle || 'icons')"
              :key="choice.id"
              class="rsvp-action-button"
              :class="{ disabled: currentView === 'preview' }"
              type="button"
              :disabled="currentView === 'preview'"
              @click="openRsvpSheet(choice.id)"
            >
              <span class="rsvp-action-symbol">{{ choice.symbol }}</span>
              <span class="rsvp-action-label">{{ choice.label }}</span>
            </button>
          </div>
        </aside>
      </div>
    </section>
  </main>

  <main v-else class="create-page-shell">
    <div class="create-page-background" :style="createBackgroundStyle">
      <video
        v-if="createEventForm.backgroundMode === 'asset' && selectedBackgroundAsset?.kind === 'video'"
        class="create-background-video"
        :src="selectedBackgroundAsset.src"
        autoplay
        muted
        loop
        playsinline
      ></video>
      <div class="create-page-glass"></div>
    </div>

    <header class="create-topbar" aria-label="Создание события">
      <a class="brand home-brand" href="#" aria-label="Event Gallery Create" @click.prevent="closeCreateEvent">
        <span class="brand-mark">EG</span>
        <span>Event Gallery</span>
      </a>
      <div class="create-topbar-actions">
        <button class="secondary-button compact-action" type="button" @click="closeCreateEvent">Home</button>
      </div>
    </header>

    <section class="create-canvas">
      <p v-if="editingEventId" class="create-mode-note">Редактирование события</p>
      <form class="create-stream" @submit.prevent="saveEvent">
        <section id="create-core" class="create-primary-card">
          <input
            v-model="createEventForm.title"
            class="title-input"
            :class="getTitleStyleClass(createEventForm.titleStyle)"
            type="text"
            placeholder="Untitled Event"
            required
          />
          <div class="title-style-row">
            <button
              v-for="option in titleStyleOptions"
              :key="option.id"
              class="title-style-chip"
              :class="{ active: createEventForm.titleStyle === option.id }"
              type="button"
              @click="createEventForm.titleStyle = option.id"
            >
              {{ option.label }}
            </button>
          </div>

          <div class="create-core-stack">
            <div class="datetime-card">
              <label class="stream-field">
                <span>Дата начала</span>
                <input v-model="createEventForm.startDate" :min="minStartDate" type="date" required />
              </label>
              <div class="time-select-card">
                <span>Время начала</span>
                <div class="time-select-row">
                  <select v-model="createEventForm.startHour" class="time-select">
                    <option v-for="hour in availableStartHours" :key="`start-hour-${hour}`" :value="hour">
                      {{ hour }}
                    </option>
                  </select>
                  <span class="time-divider">:</span>
                  <select v-model="createEventForm.startMinute" class="time-select">
                    <option
                      v-for="minute in availableStartMinutes"
                      :key="`start-minute-${minute}`"
                      :value="minute"
                    >
                      {{ minute }}
                    </option>
                  </select>
                </div>
              </div>
            </div>

            <div class="datetime-card optional-field">
              <label class="stream-field">
                <span>Дата окончания</span>
                <input v-model="createEventForm.endDate" :min="createEventForm.startDate" type="date" />
              </label>
              <div class="time-select-card">
                <span>Время окончания</span>
                <div class="time-select-row">
                  <select v-model="createEventForm.endHour" class="time-select">
                    <option v-for="hour in availableEndHours" :key="`end-hour-${hour}`" :value="hour">
                      {{ hour }}
                    </option>
                  </select>
                  <span class="time-divider">:</span>
                  <select v-model="createEventForm.endMinute" class="time-select">
                    <option v-for="minute in availableEndMinutes" :key="`end-minute-${minute}`" :value="minute">
                      {{ minute }}
                    </option>
                  </select>
                </div>
              </div>
            </div>

            <label class="stream-field host-field">
              <span>Проводит</span>
              <div class="stream-inline-row">
                <div class="stream-avatar-card">
                  <span
                    class="stream-avatar"
                    :class="{ filled: Boolean(currentUser.avatarUrl) }"
                    :style="getAvatarStyle(currentUser.avatarUrl)"
                  >
                    {{ currentUser.avatarUrl ? '' : currentUser.initials }}
                  </span>
                </div>
                <input v-model="createEventForm.hostAlias" type="text" placeholder="Имя организатора" />
              </div>
            </label>
            <label class="stream-field">
              <span>Часовой пояс</span>
              <select v-model="createEventForm.timezone" class="timezone-select">
                <option v-for="timezone in russianTimezoneOptions" :key="timezone.id" :value="timezone.id">
                  {{ timezone.label }}
                </option>
              </select>
            </label>
            <label class="stream-field">
              <span>Место</span>
              <input v-model="createEventForm.location" type="text" placeholder="Где пройдет событие?" />
            </label>
            <label class="stream-field">
              <span>Максимум участников</span>
              <input
                v-model="createEventForm.participantLimit"
                type="number"
                min="1"
                placeholder="Без ограничения"
              />
            </label>
            <section class="payment-shell">
              <div class="payment-switch-row">
                <span>Платность события</span>
                <div class="payment-switcher">
                  <button
                    class="payment-switch-option"
                    :class="{ active: !createPaymentEnabled }"
                    type="button"
                    @click="createEventForm.paymentEnabled = false"
                  >
                    Бесплатно
                  </button>
                  <button
                    class="payment-switch-option"
                    :class="{ active: createPaymentEnabled }"
                    type="button"
                    @click="createEventForm.paymentEnabled = true"
                  >
                    Платно
                  </button>
                </div>
              </div>

              <div v-if="createPaymentEnabled" class="payment-fields-grid">
                <label class="stream-field">
                  <span>Стоимость с человека</span>
                  <input v-model="createEventForm.costPerPerson" type="text" placeholder="300 ₽" />
                </label>
                <label class="stream-field">
                  <span>Куда переводить</span>
                  <input v-model="createEventForm.paymentDestination" type="text" placeholder="Сбер +7..." />
                </label>
                <label class="stream-field">
                  <span>Комментарий к оплате</span>
                  <input v-model="createEventForm.paymentComment" type="text" placeholder="Например, за еду и аренду" />
                </label>
              </div>
            </section>

            <label class="stream-inline-toggle">
              <input v-model="createEventForm.allowGuestInvites" type="checkbox" />
              <span>Гости могут приглашать других</span>
            </label>

            <p v-if="startIsInPast" class="validation-note">
              Начало события нельзя поставить в прошлое. Выберите сегодняшнюю дату и более позднее время.
            </p>
            <p v-else-if="endBeforeStart" class="validation-note">
              Окончание не может быть раньше начала. Доступны только дата и время не раньше старта.
            </p>
          </div>
        </section>

        <section id="create-links" class="create-panel-shell">
          <div class="quick-tag-row">
            <button
              v-for="option in quickInfoOptions"
              :key="option.value"
              class="quick-tag-chip"
              type="button"
              @click="
                createEventForm.infoBlocks = [
                  ...createEventForm.infoBlocks,
                  { id: createId('block'), type: option.value, icon: option.emoji, title: option.label, description: '', link: '' },
                ]
              "
            >
              + {{ option.label }}
            </button>
            <button
              class="quick-tag-chip"
              type="button"
              @click="
                createEventForm.infoBlocks = [
                  ...createEventForm.infoBlocks,
                  { id: createId('block'), type: 'other', icon: '📝', title: '', description: '', link: '' },
                ]
              "
            >
              + Свой тег
            </button>
          </div>

          <div v-if="createEventForm.infoBlocks.length" class="inline-info-editor">
            <article v-for="block in createEventForm.infoBlocks" :key="block.id" class="inline-tag-card">
              <div class="inline-tag-head">
                <span class="tag-icon">{{ block.icon }}</span>
                <template v-if="block.type === 'other'">
                  <input v-model="block.title" type="text" placeholder="Название тега" />
                </template>
                <strong v-else>{{ block.title }}</strong>
                <button class="ghost-inline-button" type="button" @click="removeInfoBlock(block.id)">×</button>
              </div>
              <input v-model="block.link" type="url" placeholder="Вставьте ссылку" />
            </article>
          </div>
        </section>

        <section id="create-description" class="create-panel-shell create-panel-soft">
          <label class="description-area">
            <textarea
              v-model="createEventForm.description"
              rows="4"
              placeholder="Описание события"
            ></textarea>
          </label>
        </section>

        <section id="create-achievements" class="create-panel-shell achievement-stream-section">
          <article class="achievement-block-shell" :class="{ collapsed: !createEventForm.automaticExpanded }">
            <div class="achievement-block-header">
              <button
                class="accordion-button"
                type="button"
                @click="createEventForm.automaticExpanded = !createEventForm.automaticExpanded"
              >
                Автоматические достижения
              </button>
              <div class="selected-pill-row">
                <div
                  v-for="template in selectedAutomaticTemplates"
                  :key="template.id"
                  class="selected-pill-wrap"
                >
                  <button
                    class="selected-achievement-pill"
                    :style="{ '--medal-tone': template.tone }"
                    type="button"
                    @click="toggleCreateAchievementPopover(getCreateAchievementKey('automatic', template.id))"
                  >
                    <span class="selected-pill-icon">{{ template.icon }}</span>
                    <span class="selected-pill-text">{{ template.title }}</span>
                  </button>
                  <button
                    class="selected-pill-remove"
                    type="button"
                    @click.stop="removeSelectedAchievement(template.id, 'automatic')"
                  >
                    ×
                  </button>
                  <div
                    v-if="createAchievementPopover === getCreateAchievementKey('automatic', template.id)"
                    class="selected-pill-popover"
                  >
                    <strong>{{ template.title }}</strong>
                    <p>{{ template.description }}</p>
                  </div>
                </div>
              </div>
              <button
                class="achievement-collapse-button"
                type="button"
                @click="createEventForm.automaticExpanded = !createEventForm.automaticExpanded"
              >
                {{ createEventForm.automaticExpanded ? '–' : '+' }}
              </button>
            </div>

            <div v-if="createEventForm.automaticExpanded" class="achievement-available-list">
              <article
                v-for="template in availableAutomaticTemplates"
                :key="template.id"
                class="available-achievement-card"
              >
                <span class="available-achievement-icon" :style="{ '--medal-tone': template.tone }">
                  {{ template.icon }}
                </span>
                <div class="available-achievement-copy">
                  <strong>{{ template.title }}</strong>
                  <p>{{ template.description }}</p>
                </div>
                <div class="available-achievement-actions">
                  <button class="secondary-button compact-action wide" type="button" @click="toggleAutomaticTemplate(template.id)">
                    Выбрать
                  </button>
                </div>
              </article>
              <p v-if="!availableAutomaticTemplates.length" class="achievement-empty-note">
                Все автоматические достижения уже выбраны.
              </p>
            </div>
          </article>

          <article class="achievement-block-shell" :class="{ collapsed: !createEventForm.personalExpanded }">
            <div class="achievement-block-header">
              <button
                class="accordion-button"
                type="button"
                @click="createEventForm.personalExpanded = !createEventForm.personalExpanded"
              >
                Личные медали
              </button>
              <div class="selected-pill-row">
                <div
                  v-for="template in selectedPersonalTemplates"
                  :key="template.id"
                  class="selected-pill-wrap"
                >
                  <button
                    class="selected-achievement-pill"
                    :style="{ '--medal-tone': template.tone }"
                    type="button"
                    @click="toggleCreateAchievementPopover(getCreateAchievementKey('personal', template.id))"
                  >
                    <span class="selected-pill-icon">{{ template.icon }}</span>
                    <span class="selected-pill-text">{{ template.title }}</span>
                  </button>
                  <button
                    class="selected-pill-remove"
                    type="button"
                    @click.stop="removeSelectedAchievement(template.id, 'personal')"
                  >
                    ×
                  </button>
                  <div
                    v-if="createAchievementPopover === getCreateAchievementKey('personal', template.id)"
                    class="selected-pill-popover"
                  >
                    <strong>{{ template.title }}</strong>
                    <p>{{ template.description }}</p>
                  </div>
                </div>
              </div>
              <button
                class="achievement-collapse-button"
                type="button"
                @click="createEventForm.personalExpanded = !createEventForm.personalExpanded"
              >
                {{ createEventForm.personalExpanded ? '–' : '+' }}
              </button>
            </div>

            <div v-if="createEventForm.personalExpanded" class="achievement-available-wrap">
              <div class="achievement-toolbar">
                <span class="achievement-toolbar-pill">Из шаблонов</span>
                <button class="ghost-button compact-action" type="button" @click="openMedalBuilder('personal')">
                  Создать
                </button>
              </div>

              <div class="achievement-available-list">
                <article
                  v-for="template in availablePersonalTemplates"
                  :key="template.id"
                  class="available-achievement-card"
                >
                  <span class="available-achievement-icon" :style="{ '--medal-tone': template.tone }">
                    {{ template.icon }}
                  </span>
                  <div class="available-achievement-copy">
                    <strong>{{ template.title }}</strong>
                    <p>{{ template.description }}</p>
                  </div>
                  <div class="available-achievement-actions">
                    <button class="secondary-button compact-action wide" type="button" @click="toggleManualTemplate(template.id, 'personal')">
                      Выбрать
                    </button>
                    <button class="template-delete-button" type="button" @click="deleteTemplate(template.id)">
                      Удалить
                    </button>
                  </div>
                </article>
                <p v-if="!availablePersonalTemplates.length" class="achievement-empty-note">
                  Пока пусто. Добавленные медали будут появляться здесь и удаляться по клику.
                </p>
              </div>
            </div>
          </article>

          <article class="achievement-block-shell" :class="{ collapsed: !createEventForm.groupExpanded }">
            <div class="achievement-block-header">
              <button
                class="accordion-button"
                type="button"
                @click="createEventForm.groupExpanded = !createEventForm.groupExpanded"
              >
                Групповые медали
              </button>
              <div class="selected-pill-row">
                <div
                  v-for="template in selectedGroupTemplates"
                  :key="template.id"
                  class="selected-pill-wrap"
                >
                  <button
                    class="selected-achievement-pill"
                    :style="{ '--medal-tone': template.tone }"
                    type="button"
                    @click="toggleCreateAchievementPopover(getCreateAchievementKey('group', template.id))"
                  >
                    <span class="selected-pill-icon">{{ template.icon }}</span>
                    <span class="selected-pill-text">{{ template.title }}</span>
                  </button>
                  <button
                    class="selected-pill-remove"
                    type="button"
                    @click.stop="removeSelectedAchievement(template.id, 'group')"
                  >
                    ×
                  </button>
                  <div
                    v-if="createAchievementPopover === getCreateAchievementKey('group', template.id)"
                    class="selected-pill-popover"
                  >
                    <strong>{{ template.title }}</strong>
                    <p>{{ template.description }}</p>
                  </div>
                </div>
              </div>
              <button
                class="achievement-collapse-button"
                type="button"
                @click="createEventForm.groupExpanded = !createEventForm.groupExpanded"
              >
                {{ createEventForm.groupExpanded ? '–' : '+' }}
              </button>
            </div>

            <div v-if="createEventForm.groupExpanded" class="achievement-available-wrap">
              <div class="achievement-toolbar">
                <span class="achievement-toolbar-pill">Из шаблонов</span>
                <button class="ghost-button compact-action" type="button" @click="openMedalBuilder('group')">
                  Создать
                </button>
              </div>

              <div class="achievement-available-list">
                <article
                  v-for="template in availableGroupTemplates"
                  :key="template.id"
                  class="available-achievement-card"
                >
                  <span class="available-achievement-icon" :style="{ '--medal-tone': template.tone }">
                    {{ template.icon }}
                  </span>
                  <div class="available-achievement-copy">
                    <strong>{{ template.title }}</strong>
                    <p>{{ template.description }}</p>
                  </div>
                  <div class="available-achievement-actions">
                    <button class="secondary-button compact-action wide" type="button" @click="toggleManualTemplate(template.id, 'group')">
                      Выбрать
                    </button>
                    <button class="template-delete-button" type="button" @click="deleteTemplate(template.id)">
                      Удалить
                    </button>
                  </div>
                </article>
                <p v-if="!availableGroupTemplates.length" class="achievement-empty-note">
                  Здесь будут медали для всей компании.
                </p>
              </div>
            </div>
          </article>
        </section>

        <div class="create-submit-row">
          <button class="secondary-button" type="button" @click="closeCreateEvent">Назад</button>
          <button class="primary-button" :disabled="!canSaveEvent" type="submit">
            {{ editingEventId ? 'Сохранить изменения' : 'Добавить событие' }}
          </button>
        </div>
      </form>

      <aside class="create-side-stage">
        <section id="create-cover" class="cover-stage">
          <button class="cover-change-button" type="button" @click="coverPickerOpen = true">
            <template v-if="selectedCoverAsset">
              <img
                class="cover-stage-image"
                :src="selectedCoverAsset.src"
                :alt="selectedCoverAsset.label"
                decoding="async"
              />
            </template>
            <span v-else class="cover-stage-fallback">Выбери обложку</span>
          </button>
          <p class="cover-stage-note">Нажми на картинку, чтобы выбрать другую обложку или загрузить свою.</p>
        </section>

        <section id="create-rsvp" class="rsvp-panel">
          <div class="rsvp-panel-head">
            <strong>RSVP Options</strong>
          </div>
          <div class="rsvp-style-row">
            <button
              v-for="option in rsvpStyleOptions"
              :key="option.id"
              class="rsvp-style-chip"
              :class="{ active: createEventForm.rsvpStyle === option.id }"
              type="button"
              @click="createEventForm.rsvpStyle = option.id"
            >
              <span>{{ option.emoji }}</span>
              {{ option.label }}
            </button>
          </div>
          <div class="rsvp-preview-row rsvp-preview-row-labeled" :data-style="createEventForm.rsvpStyle">
            <div
              v-for="choice in getRsvpChoices(createEventForm.rsvpStyle)"
              :key="`${createEventForm.rsvpStyle}-${choice.id}`"
              class="rsvp-preview-option"
            >
              <span class="rsvp-preview-bubble">{{ choice.symbol }}</span>
              <span class="rsvp-preview-option-label">{{ choice.label }}</span>
            </div>
          </div>
        </section>

        <section id="create-assets" class="asset-browser">
          <div class="asset-browser-group">
            <strong>Фон страницы</strong>
            <div class="background-mode-row">
              <button
                class="background-mode-button"
                :class="{ active: createEventForm.backgroundMode === 'asset' }"
                type="button"
                @click="createEventForm.backgroundMode = 'asset'; createEventForm.backgroundMediaType = getAssetBackgroundMediaType(getAssetById(backgroundAssetOptions, createEventForm.backgroundAssetId))"
              >
                Из подборки
              </button>
              <button
                class="background-mode-button"
                :class="{ active: createEventForm.backgroundMode === 'color' }"
                type="button"
                @click="createEventForm.backgroundMode = 'color'"
              >
                Цвет
              </button>
            </div>

            <div v-if="createEventForm.backgroundMode === 'asset'" class="asset-strip backgrounds">
              <button
                v-for="asset in backgroundAssetOptions"
                :key="asset.id"
                class="asset-thumb background-thumb"
                :class="{ active: createEventForm.backgroundAssetId === asset.id && !createEventForm.uploadedBackgroundUrl }"
                type="button"
                @click="createEventForm.backgroundAssetId = asset.id; createEventForm.uploadedBackgroundUrl = null; createEventForm.backgroundMediaType = getAssetBackgroundMediaType(asset)"
              >
                <template v-if="asset.kind === 'image'">
                  <img :src="asset.src" :alt="asset.label" />
                </template>
                <template v-else>
                  <video :src="asset.src" muted autoplay loop playsinline></video>
                </template>
              </button>
            </div>
            <div v-else class="custom-color-panel">
              <div class="custom-color-head">
                <strong>Свой цвет</strong>
              </div>
              <div
                class="custom-color-preview"
                :style="{ background: createEventForm.backgroundColor }"
              ></div>
              <label class="custom-color-hue">
                <span>Оттенок</span>
                <input
                  v-model.number="backgroundColorHue"
                  class="hue-slider"
                  type="range"
                  min="0"
                  max="360"
                  @input="updateBackgroundFromHue"
                />
              </label>
              <div class="color-swatch-row">
                <button
                  v-for="color in softBackgroundColors"
                  :key="color"
                  class="color-swatch"
                  :class="{ active: createEventForm.backgroundColor === color }"
                  :style="{ background: color }"
                  type="button"
                  :aria-label="`Цвет ${color}`"
                  @click="applyBackgroundColor(color)"
                ></button>
              </div>
            </div>
            <label v-if="createEventForm.backgroundMode === 'asset'" class="upload-chip small">
              Свой фон
              <input
                type="file"
                accept="image/*,video/mp4,video/webm,.mp4,.webm"
                hidden
                @change="handleBackgroundUpload"
              />
            </label>
          </div>
        </section>
      </aside>

      <nav class="create-side-bar" aria-label="Быстрые действия">
        <button class="side-action-button" type="button" @click="scrollToCreateSection('create-assets')">
          <span>🎬</span>
          <small>Theme</small>
        </button>
        <button class="side-action-button" type="button" @click="scrollToCreateSection('create-rsvp')">
          <span>{{ getRsvpStyleOption(createEventForm.rsvpStyle).emoji }}</span>
          <small>RSVP</small>
        </button>
        <button class="side-action-button" type="button" @click="openGuestPreview">
          <span>👁</span>
          <small>Preview</small>
        </button>
      </nav>
    </section>

    <div v-if="coverPickerOpen" class="cover-picker-overlay" @click.self="coverPickerOpen = false">
      <section class="cover-picker-sheet" aria-modal="true" role="dialog" aria-labelledby="cover-picker-title">
        <button class="cover-picker-close" type="button" @click="coverPickerOpen = false">×</button>
        <div class="cover-picker-head">
          <h3 id="cover-picker-title">Выбор обложки</h3>
          <input
            v-model="coverSearchQuery"
            class="cover-search-input"
            type="text"
            placeholder="Найти картинку..."
          />
        </div>

        <div class="cover-picker-tabs" role="tablist" aria-label="Тип обложки">
          <button
            type="button"
            role="tab"
            class="cover-picker-tab"
            :class="{ active: coverPickerTab === 'posters' }"
            :aria-selected="coverPickerTab === 'posters'"
            @click="coverPickerTab = 'posters'"
          >
            Постеры
          </button>
          <button
            type="button"
            role="tab"
            class="cover-picker-tab"
            :class="{ active: coverPickerTab === 'gifs' }"
            :aria-selected="coverPickerTab === 'gifs'"
            @click="coverPickerTab = 'gifs'"
          >
            GIF
          </button>
        </div>

        <div v-if="activeCoverPickerAssets.length" class="cover-picker-section">
          <div class="cover-picker-grid">
            <button
              v-for="asset in activeCoverPickerAssets"
              :key="asset.id"
              class="cover-picker-tile"
              :class="{ active: createEventForm.coverAssetId === asset.id && !createEventForm.uploadedCoverUrl }"
              type="button"
              @click="createEventForm.coverAssetId = asset.id; createEventForm.uploadedCoverUrl = null; coverPickerOpen = false"
            >
              <img :src="asset.src" :alt="asset.label" decoding="async" />
            </button>
          </div>
        </div>
        <p v-else class="cover-picker-empty">Ничего не найдено. Попробуйте другой запрос.</p>

        <label class="cover-upload-tile">
          Загрузить свою обложку
          <input type="file" accept="image/*,.gif" hidden @change="handleCoverUpload" />
        </label>
      </section>
    </div>

    <div v-if="medalBuilderOpen" class="medal-builder-overlay" @click.self="medalBuilderOpen = false">
      <section class="medal-builder-dialog" aria-modal="true" role="dialog" aria-labelledby="medal-builder-title">
        <div class="section-title-row">
          <h3 id="medal-builder-title">{{ medalForm.scope === 'group' ? 'Групповая медаль' : 'Личная медаль' }}</h3>
          <button class="ghost-inline-button" type="button" @click="medalBuilderOpen = false">Закрыть</button>
        </div>

        <div class="form-field-grid">
          <label class="field-block field-span-2">
            <span>Название *</span>
            <input v-model="medalForm.title" type="text" placeholder="Например, Лучший образ" />
          </label>
          <label class="field-block field-span-2">
            <span>Описание *</span>
            <textarea v-model="medalForm.description" rows="3" placeholder="За что выдается эта медаль"></textarea>
          </label>
          <div class="field-block field-span-2 emoji-picker-field">
            <span>Emoji</span>
            <button
              class="emoji-picker-trigger"
              type="button"
              @click="emojiPickerOpen = !emojiPickerOpen"
            >
              <span class="emoji-picker-current">{{ medalForm.icon || '🏅' }}</span>
              <span>Выбрать emoji</span>
            </button>
            <div v-if="emojiPickerOpen" class="emoji-picker-popover">
              <emoji-picker class="medal-emoji-picker" @emoji-click="onEmojiPickerSelect"></emoji-picker>
            </div>
            <div class="emoji-quick-row">
              <button
                v-for="emoji in emojiPickerOptions"
                :key="emoji"
                class="emoji-picker-option"
                :class="{ active: medalForm.icon === emoji }"
                type="button"
                @click="medalForm.icon = emoji"
              >
                {{ emoji }}
              </button>
            </div>
          </div>
        </div>

        <div class="medal-preview-row">
          <span class="medal-card-preview" :style="{ '--medal-tone': medalForm.tone }">
            {{ medalForm.icon || '🏅' }}
          </span>
          <div class="medal-preview-copy">
            <strong>{{ medalForm.title || 'Название медали' }}</strong>
            <p>{{ medalForm.description || 'Описание появится здесь.' }}</p>
          </div>
        </div>

        <div class="medal-tone-row">
          <span>Фон медали</span>
          <div class="tone-swatch-row">
            <button
              v-for="tone in medalToneOptions"
              :key="tone"
              class="tone-swatch"
              :class="{ active: medalForm.tone === tone }"
              :style="{ background: `linear-gradient(135deg, ${tone})` }"
              type="button"
              @click="medalForm.tone = tone"
            ></button>
          </div>
        </div>

        <label class="toggle-card">
          <input v-model="medalForm.saveAsTemplate" type="checkbox" />
          <span>Сохранить как шаблон для будущих событий</span>
        </label>

        <div class="create-actions">
          <button class="secondary-button" type="button" @click="medalBuilderOpen = false">Отмена</button>
          <button class="primary-button" type="button" @click="saveCustomMedal">Сохранить медаль</button>
        </div>
      </section>
    </div>
  </main>
  <div v-if="authOpen" class="auth-backdrop" @click.self="authOpen = false">
    <section class="auth-dialog" aria-modal="true" role="dialog" aria-labelledby="auth-title">
      <button class="close-button" type="button" aria-label="Закрыть" @click="authOpen = false">×</button>

      <p class="eyebrow">Event Gallery</p>
      <h2 id="auth-title">Вход</h2>
      <p class="auth-subtitle">Гостевой вход остается самым быстрым сценарием, а профиль можно привязать через email-код.</p>
      <p v-if="pendingInviteCode" class="auth-hint">Вы заходите по приглашению <strong>{{ pendingInviteCode }}</strong>.</p>

      <div class="auth-tabs" role="tablist" aria-label="Способ входа">
        <button
          type="button"
          role="tab"
          :aria-selected="authMode === 'guest'"
          :class="{ active: authMode === 'guest' }"
          @click="authMode = 'guest'"
        >
          Войти как гость
        </button>
        <button
          type="button"
          role="tab"
          :aria-selected="authMode === 'profile'"
          :class="{ active: authMode === 'profile' }"
          @click="authMode = 'profile'"
        >
          Войти по email
        </button>
      </div>

      <form class="auth-form" @submit.prevent="completeAuth">
        <template v-if="authMode === 'guest'">
          <label>
            Имя участника
            <input
              v-model="authGuestName"
              type="text"
              placeholder="Например, Аня"
              autocomplete="name"
            />
          </label>
          <p class="auth-hint">Если поле пустое, приложение создаст имя вроде “Гость 4821”.</p>
          <button class="primary-button full" type="submit">Продолжить</button>
        </template>

        <template v-else>
          <label>
            Email
            <input
              v-model="authEmail"
              type="email"
              placeholder="student@example.ru"
              autocomplete="email"
            />
          </label>
          <button class="secondary-button full" type="button" @click="requestAuthCode">
            Получить код
          </button>
          <label>
            Код подтверждения
            <input
              v-model="authCode"
              type="text"
              placeholder="000000"
              autocomplete="one-time-code"
            />
          </label>
          <p class="auth-hint">Код для разработки: <strong>000000</strong></p>
          <button class="primary-button full" type="submit">
            {{ currentUser.mode === 'guest' || currentUser.mode === 'demo' ? 'Создать профиль' : 'Войти' }}
          </button>
        </template>
      </form>
      <p v-if="authError" class="auth-subtitle">{{ authError }}</p>
    </section>
  </div>

  <div v-if="profileEditorOpen" class="auth-backdrop" @click.self="closeProfileEditor">
    <section class="auth-dialog profile-editor-dialog" aria-modal="true" role="dialog" aria-labelledby="profile-title">
      <button class="close-button" type="button" aria-label="Закрыть" @click="closeProfileEditor">×</button>

      <p class="eyebrow">Профиль</p>
      <h2 id="profile-title">Имя и аватар</h2>
      <p class="auth-subtitle">Глобальное имя аккаунта редактируется отдельно от имени участника внутри конкретного события.</p>

      <form class="auth-form" @submit.prevent="saveProfileEditor">
        <div class="profile-editor-avatar-row">
          <span
            class="profile-editor-avatar"
            :class="{ filled: Boolean(profileEditorAvatarUrl) }"
            :style="getAvatarStyle(profileEditorAvatarUrl || undefined)"
          >
            {{ profileEditorAvatarUrl ? '' : buildUserInitials(profileEditorName || currentUser.name) }}
          </span>
          <div class="profile-editor-copy">
            <strong>Аватар профиля</strong>
            <span>PNG, JPEG или WEBP до 2 МБ</span>
            <button class="secondary-button" type="button" @click="triggerProfileAvatarPicker">
              Загрузить изображение
            </button>
          </div>
        </div>

        <label>
          Имя
          <input
            v-model="profileEditorName"
            type="text"
            placeholder="Как показывать вас в профиле"
            autocomplete="name"
          />
        </label>

        <div class="create-actions">
          <button class="secondary-button" type="button" @click="closeProfileEditor">Отмена</button>
          <button class="primary-button" type="submit">Сохранить</button>
        </div>
      </form>
      <p v-if="profileEditorError" class="auth-subtitle">{{ profileEditorError }}</p>
    </section>
  </div>

  <input
    ref="albumPhotoInput"
    type="file"
    accept="image/*,.gif"
    hidden
    @change="handleAlbumPhotoUpload"
  />
  <input ref="chatPhotoInput" type="file" accept="image/*,.gif" hidden @change="handleChatPhotoUpload" />
  <input
    ref="profileAvatarInput"
    type="file"
    accept="image/png,image/jpeg,image/webp"
    hidden
    @change="handleProfileAvatarUpload"
  />

  <div v-if="rsvpSheetOpen && rsvpSheetStatus" class="rsvp-sheet-overlay" @click.self="closeRsvpSheet">
    <section class="rsvp-sheet" aria-modal="true" role="dialog" aria-labelledby="rsvp-sheet-title">
      <div class="rsvp-sheet-preview-row">
        <button
          v-for="choice in getRsvpChoices(activeEvent?.rsvpStyle || 'icons')"
          :key="`sheet-${choice.id}`"
          class="rsvp-sheet-choice"
          :class="{ active: rsvpSheetStatus === choice.id }"
          type="button"
          @click="rsvpSheetStatus = choice.id"
        >
          <span class="rsvp-action-symbol">{{ choice.symbol }}</span>
          <span class="rsvp-action-label">{{ choice.label }}</span>
        </button>
      </div>

      <div class="rsvp-sheet-user">
        <span class="rsvp-sheet-user-label">Отвечаете как</span>
        <span class="guest-avatar-chip">{{
          currentParticipant ? buildUserInitials(currentParticipant.displayName) : currentUser.initials
        }}</span>
        <strong>{{ currentParticipant?.displayName || currentUser.name }}</strong>
      </div>

      <label class="rsvp-sheet-message">
        <span>+ Добавить сообщение</span>
        <textarea
          v-model="rsvpSheetMessage"
          rows="3"
          placeholder="Напишите организатору..."
        ></textarea>
      </label>

      <div class="rsvp-sheet-actions">
        <button class="ghost-button" type="button" @click="closeRsvpSheet">Отмена</button>
        <button class="primary-button" type="button" @click="submitRsvpResponse">Отправить</button>
      </div>
    </section>
  </div>

  <div
    v-if="activePhotoEntry"
    class="photo-viewer"
    :style="{
      '--event-start': activePhotoEntry.event.backgroundStart,
      '--event-end': activePhotoEntry.event.backgroundEnd,
      '--photo-tone': activePhotoEntry.photo.tone,
    }"
    @click.self="closePhoto"
  >
    <section class="photo-viewer-card" aria-label="Просмотр фото">
      <button class="viewer-close" type="button" aria-label="Закрыть" @click="closePhoto">×</button>
      <div class="viewer-photo" :style="getPhotoStyle(activePhotoEntry.photo)"></div>
      <div class="viewer-info">
        <span>{{ activePhotoEntry.event.title }}</span>
        <h3>Фото из события</h3>
        <p>
          {{ getPhotoCommentCountLabel(selectedPhotoComments.length) }} · {{ formatEventDateLabel(activePhotoEntry.event.startsAt) }}
        </p>
      </div>
      <div class="viewer-actions">
        <button
          class="secondary-button"
          type="button"
          @click="togglePhotoSaved(activePhotoEntry.event.id, activePhotoEntry.photo.id)"
        >
          {{ isPhotoSaved(activePhotoEntry.event.id, activePhotoEntry.photo.id) ? 'Убрать из сохранённых' : 'Сохранить' }}
        </button>
        <button class="secondary-button" type="button" @click="stepPhoto(-1)">Назад</button>
        <button class="primary-button" type="button" @click="stepPhoto(1)">Дальше</button>
      </div>
      <section class="viewer-comments" aria-label="Комментарии к фото">
        <div class="viewer-comments-head">
          <strong>Комментарии</strong>
          <span>{{ getPhotoCommentCountLabel(selectedPhotoComments.length) }}</span>
        </div>
        <div v-if="selectedPhotoComments.length" class="viewer-comments-list">
          <article v-for="comment in selectedPhotoComments" :key="comment.id" class="viewer-comment-item">
            <span
              class="guest-avatar-chip viewer-comment-avatar"
              :class="{ filled: Boolean(comment.authorAvatarUrl) }"
              :style="getAvatarStyle(comment.authorAvatarUrl)"
            >
              {{ comment.authorAvatarUrl ? '' : buildUserInitials(comment.authorName) }}
            </span>
            <div class="viewer-comment-copy">
              <strong>{{ comment.authorName }}</strong>
              <p>{{ comment.text }}</p>
            </div>
          </article>
        </div>
        <p v-else class="viewer-comments-empty">Пока без комментариев. Здесь можно сохранить шутки и контекст события.</p>

        <form v-if="canWritePhotoComments" class="viewer-comment-form" @submit.prevent="submitPhotoComment">
          <input v-model="photoCommentDraft" type="text" placeholder="Написать комментарий к фото..." />
          <button class="primary-button compact-action" type="submit">Отправить</button>
        </form>
        <p v-if="photoCommentError" class="viewer-comments-error">{{ photoCommentError }}</p>

        <div v-if="!canWritePhotoComments" class="viewer-comments-note">
          <span>
            {{
              currentView === 'home'
                ? 'Комментарии доступны в событии и не копируются в личную галерею.'
                : 'Комментарии станут доступны после сохранения события.'
            }}
          </span>
          <button
            v-if="currentView === 'home'"
            class="secondary-button compact-action"
            type="button"
            @click="openEventPage(activePhotoEntry.event.id)"
          >
            Открыть в событии
          </button>
        </div>
      </section>
    </section>
  </div>
</template>

