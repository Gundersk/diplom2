import type {
  EventChatMessage,
  EventRole,
  EventTab,
  GalleryEvent,
} from '../types/event'
import type {
  AchievementMode,
  EventAchievement,
} from '../types/achievement'
import type { GalleryPhoto } from '../types/photo'

type SeedAchievement = {
  id: string
  title: string
  description: string
  icon: string
  tone: string
}

type SeedPhoto = {
  id: string
  tone: string
  likes: number
  saved?: boolean
}

type SeedEvent = {
  id: string
  title: string
  startsAt: string
  endsAt: string
  date: string
  status: EventTab
  sortOrder: number
  role: string
  organizerName: string
  organizerInitials: string
  organizerTone: string
  location: string
  savedCount: number
  totalCount: number
  coverStart: string
  coverEnd: string
  accent: string
  achievements: SeedAchievement[]
  photos: SeedPhoto[]
  description?: string
}

const automaticById: Record<
  string,
  { conditionType: EventAchievement['conditionType']; mode: AchievementMode }
> = {
  'album-favorite': { conditionType: 'most_likes', mode: 'automatic' },
  'first-frame': { conditionType: 'first_photo', mode: 'automatic' },
  paparazzi: { conditionType: 'most_photos', mode: 'automatic' },
  'top-like': { conditionType: 'most_likes', mode: 'automatic' },
  'warm-frame': { conditionType: 'most_likes', mode: 'automatic' },
}

const groupIds = new Set([
  'after-defense',
  'group-shot',
  'nature-story',
  'photo-wave',
  'quiet-story',
  'route-done',
])

export const homeEventSeeds: SeedEvent[] = [
  {
    id: 'campus-night',
    title: 'Фото-вечер у кампуса',
    startsAt: '2026-05-18T18:30',
    endsAt: '2026-05-18T22:30',
    date: '18 мая, 18:30',
    status: 'current',
    sortOrder: 1,
    role: 'Организатор',
    organizerName: 'Юрий',
    organizerInitials: 'Ю',
    organizerTone: '#ffd166,#41d3bd',
    location: 'Учебный корпус',
    savedCount: 18,
    totalCount: 126,
    coverStart: '#ff7a59',
    coverEnd: '#41d3bd',
    accent: '#ff4d6d',
    achievements: [
      {
        id: 'paparazzi',
        title: 'Папарацци',
        description: 'Выдается участнику, который добавил больше всех фото в общий альбом.',
        icon: '📸',
        tone: '#ff4d6d,#ffd166',
      },
      {
        id: 'first-frame',
        title: 'Первый кадр',
        description: 'Получает участник, который первым загрузил фото после открытия альбома.',
        icon: '🥇',
        tone: '#41d3bd,#5b8def',
      },
      {
        id: 'group-shot',
        title: 'Общий кадр',
        description: 'Групповое достижение события: в альбоме появился снимок всей компании.',
        icon: '👥',
        tone: '#8a5cf6,#ffb703',
      },
    ],
    photos: [
      { id: 'campus-1', tone: '#ff7a59,#ffd166,#41d3bd', likes: 48 },
      { id: 'campus-2', tone: '#41d3bd,#5b8def,#ffffff', likes: 21 },
      { id: 'campus-3', tone: '#ff4d6d,#ffd166,#111111', likes: 36 },
      { id: 'campus-4', tone: '#151515,#8a5cf6,#ffb703', likes: 17 },
      { id: 'campus-5', tone: '#ffffff,#41d3bd,#ff7a59', likes: 12 },
      { id: 'campus-6', tone: '#5b8def,#ffffff,#ffd166', likes: 31 },
      { id: 'campus-7', tone: '#ffb703,#ff4d6d,#151515', likes: 26 },
      { id: 'campus-8', tone: '#41d3bd,#151515,#8a5cf6', likes: 19 },
    ],
  },
  {
    id: 'design-review',
    title: 'Разбор макетов',
    startsAt: '2026-05-19T15:00',
    endsAt: '2026-05-19T18:00',
    date: '19 мая, 15:00',
    status: 'current',
    sortOrder: 2,
    role: 'Участник',
    organizerName: 'Алина',
    organizerInitials: 'А',
    organizerTone: '#5b8def,#f7f06d',
    location: 'Коворкинг',
    savedCount: 7,
    totalCount: 42,
    coverStart: '#5b8def',
    coverEnd: '#f7f06d',
    accent: '#008f7a',
    achievements: [
      {
        id: 'album-favorite',
        title: 'Любимец альбома',
        description: 'Выдается автору фото, которое собрало больше всего лайков.',
        icon: '❤️',
        tone: '#5b8def,#f7f06d',
      },
      {
        id: 'collector',
        title: 'Коллекционер',
        description: 'Получает участник, который сохранил фото из разных частей события.',
        icon: '🗂️',
        tone: '#00c2a8,#ffffff',
      },
    ],
    photos: [
      { id: 'design-1', tone: '#5b8def,#f7f06d,#00c2a8', likes: 15 },
      { id: 'design-2', tone: '#ffffff,#5b8def,#ff4d6d', likes: 29 },
      { id: 'design-3', tone: '#00c2a8,#f7f06d,#151515', likes: 33 },
      { id: 'design-4', tone: '#f7f06d,#ffffff,#5b8def', likes: 11 },
      { id: 'design-5', tone: '#ff4d6d,#5b8def,#ffffff', likes: 24 },
    ],
  },
  {
    id: 'coffee-meet',
    title: 'Кофе после пар',
    startsAt: '2026-05-20T13:20',
    endsAt: '2026-05-20T16:20',
    date: '20 мая, 13:20',
    status: 'current',
    sortOrder: 3,
    role: 'Участник',
    organizerName: 'Марк',
    organizerInitials: 'М',
    organizerTone: '#ffd166,#ff7a59',
    location: 'Кафе у корпуса',
    savedCount: 11,
    totalCount: 38,
    coverStart: '#ffd166',
    coverEnd: '#ff7a59',
    accent: '#8a5cf6',
    achievements: [
      {
        id: 'warm-frame',
        title: 'Теплый кадр',
        description: 'Автоматическая медаль за фото, которое добавили в избранное несколько гостей.',
        icon: '☀️',
        tone: '#ffd166,#ff7a59',
      },
    ],
    photos: [
      { id: 'coffee-1', tone: '#ffd166,#ff7a59,#ffffff', likes: 18 },
      { id: 'coffee-2', tone: '#ff7a59,#151515,#ffd166', likes: 22 },
      { id: 'coffee-3', tone: '#ffffff,#ffd166,#41d3bd', likes: 10 },
      { id: 'coffee-4', tone: '#8a5cf6,#ff7a59,#ffffff', likes: 16 },
    ],
  },
  {
    id: 'grad-party',
    title: 'Выпускной проектный вечер',
    startsAt: '2026-05-24T19:00',
    endsAt: '2026-05-24T23:00',
    date: '24 мая, 19:00',
    status: 'upcoming',
    sortOrder: 1,
    role: 'Участник',
    organizerName: 'Даша',
    organizerInitials: 'Д',
    organizerTone: '#5b8def,#ff4d6d',
    location: 'Лофт на набережной',
    savedCount: 9,
    totalCount: 74,
    coverStart: '#5b8def',
    coverEnd: '#ff4d6d',
    accent: '#ffd166',
    achievements: [
      {
        id: 'after-defense',
        title: 'После защиты',
        description: 'Групповое достижение для события, где собрались участники после защиты проекта.',
        icon: '👥',
        tone: '#5b8def,#ff4d6d',
      },
      {
        id: 'top-like',
        title: 'Топ лайков',
        description: 'Выдается за фотографию, которая стала самой популярной в альбоме.',
        icon: '⭐',
        tone: '#ffb703,#ffffff',
      },
    ],
    photos: [
      { id: 'grad-1', tone: '#5b8def,#f7f06d,#00c2a8', likes: 15 },
      { id: 'grad-2', tone: '#ffffff,#5b8def,#ff4d6d', likes: 29 },
      { id: 'grad-3', tone: '#00c2a8,#f7f06d,#151515', likes: 33 },
      { id: 'grad-4', tone: '#ff4d6d,#ffd166,#5b8def', likes: 27 },
      { id: 'grad-5', tone: '#151515,#5b8def,#ffffff', likes: 20 },
      { id: 'grad-6', tone: '#f7f06d,#00c2a8,#ffffff', likes: 14 },
    ],
  },
  {
    id: 'summer-picnic',
    title: 'Пикник у озера',
    startsAt: '2026-05-31T14:00',
    endsAt: '2026-05-31T20:00',
    date: '31 мая, 14:00',
    status: 'upcoming',
    sortOrder: 2,
    role: 'Организатор',
    organizerName: 'Юрий',
    organizerInitials: 'Ю',
    organizerTone: '#41d3bd,#f7f06d',
    location: 'Городской парк',
    savedCount: 0,
    totalCount: 0,
    coverStart: '#41d3bd',
    coverEnd: '#f7f06d',
    accent: '#008f7a',
    achievements: [
      {
        id: 'nature-story',
        title: 'История дня',
        description: 'Достижение события за серию фотографий, которая показывает весь день.',
        icon: '🌿',
        tone: '#41d3bd,#f7f06d',
      },
    ],
    photos: [
      { id: 'picnic-1', tone: '#41d3bd,#f7f06d,#ffffff', likes: 0 },
      { id: 'picnic-2', tone: '#f7f06d,#5b8def,#41d3bd', likes: 0 },
      { id: 'picnic-3', tone: '#ffffff,#41d3bd,#ff7a59', likes: 0 },
    ],
  },
  {
    id: 'cinema-night',
    title: 'Киновечер',
    startsAt: '2026-06-08T20:00',
    endsAt: '2026-06-08T23:00',
    date: '8 июня, 20:00',
    status: 'upcoming',
    sortOrder: 3,
    role: 'Участник',
    organizerName: 'Ника',
    organizerInitials: 'Н',
    organizerTone: '#151515,#8a5cf6',
    location: 'Антикафе',
    savedCount: 0,
    totalCount: 0,
    coverStart: '#151515',
    coverEnd: '#8a5cf6',
    accent: '#ffb703',
    achievements: [
      {
        id: 'night-light',
        title: 'Ночной свет',
        description: 'Медаль за лучший кадр вечернего события по лайкам гостей.',
        icon: '🌙',
        tone: '#151515,#8a5cf6',
      },
    ],
    photos: [
      { id: 'cinema-1', tone: '#151515,#8a5cf6,#ffb703', likes: 0 },
      { id: 'cinema-2', tone: '#8a5cf6,#ffffff,#151515', likes: 0 },
      { id: 'cinema-3', tone: '#ffb703,#151515,#8a5cf6', likes: 0 },
    ],
  },
  {
    id: 'quest',
    title: 'Ночной квест',
    startsAt: '2026-04-12T19:00',
    endsAt: '2026-04-12T23:00',
    date: '12 апреля',
    status: 'past',
    sortOrder: 1,
    role: 'Участник',
    organizerName: 'Саша',
    organizerInitials: 'С',
    organizerTone: '#8a5cf6,#ffb703',
    location: 'Парк Гагарина',
    savedCount: 14,
    totalCount: 93,
    coverStart: '#151515',
    coverEnd: '#8a5cf6',
    accent: '#ffb703',
    achievements: [
      {
        id: 'route-done',
        title: 'Маршрут пройден',
        description: 'Групповое достижение события: команда дошла до финальной точки.',
        icon: '🧭',
        tone: '#8a5cf6,#ffb703',
      },
      {
        id: 'active-guest',
        title: 'Активный гость',
        description: 'Выдается гостю, который чаще других реагировал на фото и сообщения.',
        icon: '⚡',
        tone: '#41d3bd,#8a5cf6',
      },
    ],
    photos: [
      { id: 'quest-1', tone: '#151515,#8a5cf6,#ffb703', likes: 18 },
      { id: 'quest-2', tone: '#8a5cf6,#ffb703,#ffffff', likes: 41 },
      { id: 'quest-3', tone: '#111111,#41d3bd,#8a5cf6', likes: 26 },
      { id: 'quest-4', tone: '#ffb703,#151515,#41d3bd', likes: 13 },
      { id: 'quest-5', tone: '#ffffff,#8a5cf6,#151515', likes: 22 },
    ],
  },
  {
    id: 'winter-meet',
    title: 'Зимняя встреча',
    startsAt: '2026-02-03T18:00',
    endsAt: '2026-02-03T22:00',
    date: '3 февраля',
    status: 'past',
    sortOrder: 2,
    role: 'Организатор',
    organizerName: 'Юрий',
    organizerInitials: 'Ю',
    organizerTone: '#5b8def,#ffffff',
    location: 'Каток',
    savedCount: 21,
    totalCount: 118,
    coverStart: '#5b8def',
    coverEnd: '#ffffff',
    accent: '#41d3bd',
    achievements: [
      {
        id: 'photo-wave',
        title: 'Фото-волна',
        description: 'Событие получило медаль за большое количество загруженных снимков.',
        icon: '📷',
        tone: '#5b8def,#ffffff',
      },
      {
        id: 'memory-keeper',
        title: 'Хранитель',
        description: 'Личная медаль за сохранение большого числа фотографий из события.',
        icon: '🗂️',
        tone: '#41d3bd,#5b8def',
      },
    ],
    photos: [
      { id: 'winter-1', tone: '#5b8def,#ffffff,#41d3bd', likes: 32 },
      { id: 'winter-2', tone: '#ffffff,#5b8def,#151515', likes: 19 },
      { id: 'winter-3', tone: '#41d3bd,#ffffff,#5b8def', likes: 28 },
      { id: 'winter-4', tone: '#151515,#5b8def,#ffffff', likes: 15 },
      { id: 'winter-5', tone: '#ffffff,#41d3bd,#ff4d6d', likes: 24 },
      { id: 'winter-6', tone: '#5b8def,#f7f06d,#ffffff', likes: 17 },
    ],
  },
  {
    id: 'library-day',
    title: 'День в библиотеке',
    startsAt: '2026-01-18T12:00',
    endsAt: '2026-01-18T16:00',
    date: '18 января',
    status: 'past',
    sortOrder: 3,
    role: 'Участник',
    organizerName: 'Оля',
    organizerInitials: 'О',
    organizerTone: '#ffd166,#ffffff',
    location: 'Университетская библиотека',
    savedCount: 6,
    totalCount: 27,
    coverStart: '#ffd166',
    coverEnd: '#ffffff',
    accent: '#ff7a59',
    achievements: [
      {
        id: 'quiet-story',
        title: 'Тихая история',
        description: 'Достижение за камерное событие, где фотографии собраны в одну аккуратную историю.',
        icon: '📚',
        tone: '#ffd166,#ffffff',
      },
    ],
    photos: [
      { id: 'library-1', tone: '#ffd166,#ffffff,#151515', likes: 9 },
      { id: 'library-2', tone: '#ffffff,#ff7a59,#ffd166', likes: 14 },
      { id: 'library-3', tone: '#151515,#ffd166,#ffffff', likes: 7 },
      { id: 'library-4', tone: '#ff7a59,#ffffff,#41d3bd', likes: 11 },
    ],
  },
]

export function buildEventStatus(startsAt: string, endsAt: string): EventTab {
  const now = new Date()
  const start = new Date(startsAt)
  const end = Number.isNaN(new Date(endsAt).getTime()) ? new Date(startsAt) : new Date(endsAt)

  if (start > now) {
    return 'upcoming'
  }

  if (end < now) {
    return 'past'
  }

  return 'current'
}

function normalizeRole(role: string): EventRole {
  return role === 'Организатор' ? 'Организатор' : 'Участник'
}

function buildSeedChatMessages(seed: {
  organizerName: string
  photos: GalleryPhoto[]
  startsAt: string
}): EventChatMessage[] {
  return seed.photos.slice(0, 4).map((photo, index) => ({
    id: `seed-chat-${photo.id}`,
    authorName: index % 2 === 0 ? seed.organizerName : 'Гость',
    authorInitials: index % 2 === 0 ? seed.organizerName.slice(0, 1) : 'Г',
    text: 'добавил(а) фото в альбом',
    createdAt: seed.startsAt,
    photoId: photo.id,
  }))
}

export function normalizeSeedAchievement(seedAchievement: SeedAchievement): EventAchievement {
  return {
    ...seedAchievement,
    scope: groupIds.has(seedAchievement.id) ? 'group' : 'personal',
    mode: automaticById[seedAchievement.id]?.mode ?? 'manual',
    conditionType: automaticById[seedAchievement.id]?.conditionType,
  }
}

export function normalizeGalleryEvent(event: GalleryEvent): GalleryEvent {
  const photos = (event.photos ?? []).map((photo) => ({
    ...photo,
    eventId: photo.eventId ?? event.id,
    authorName: photo.authorName ?? event.organizerName,
    imageUrl: photo.imageUrl ?? photo.src,
    likesCount: Number(photo.likesCount ?? photo.likes) || 0,
    likedBy: Array.isArray(photo.likedBy) ? photo.likedBy : [],
    badges: Array.isArray(photo.badges) ? photo.badges : [],
    createdAt: photo.createdAt ?? event.startsAt,
    likes: Number(photo.likes) || 0,
    saved: Boolean(photo.saved),
    src: photo.src ?? photo.imageUrl,
  }))

  return {
    ...event,
    status: buildEventStatus(event.startsAt, event.endsAt),
    role: normalizeRole(event.role),
    organizerId: event.organizerId,
    organizerAvatarSrc: event.organizerAvatarSrc,
    description: event.description ?? '',
    savedCount: photos.filter((photo) => photo.saved).length,
    totalCount: photos.length,
    coverEnd: event.coverEnd ?? event.coverStart,
    backgroundStart: event.backgroundStart ?? event.coverStart,
    backgroundEnd: event.backgroundEnd ?? event.coverEnd ?? event.coverStart,
    allowGuestInvites: event.allowGuestInvites ?? false,
    participantLimit: event.participantLimit ?? null,
    infoBlocks: event.infoBlocks ?? [],
    payment: event.payment ?? null,
    timezoneLabel: event.timezoneLabel ?? 'Екатеринбург (UTC+5)',
    achievements: (event.achievements ?? []).map((achievement) => ({
      ...achievement,
      scope: achievement.scope ?? (groupIds.has(achievement.id) ? 'group' : 'personal'),
      mode: achievement.mode ?? automaticById[achievement.id]?.mode ?? 'manual',
      conditionType: achievement.conditionType ?? automaticById[achievement.id]?.conditionType,
    })),
    photos,
    chatMessages: event.chatMessages ?? buildSeedChatMessages({
      organizerName: event.organizerName,
      photos,
      startsAt: event.startsAt,
    }),
    guestRsvps: event.guestRsvps ?? [],
    titleStyle: event.titleStyle ?? 'classic',
    rsvpStyle: event.rsvpStyle ?? 'icons',
  }
}

export function normalizeSeedEvent(seed: SeedEvent): GalleryEvent {
  const photos = seed.photos.map((photo, index) => ({
    ...photo,
    saved: photo.saved ?? index < seed.savedCount,
  }))

  return normalizeGalleryEvent({
    id: seed.id,
    title: seed.title,
    status: buildEventStatus(seed.startsAt, seed.endsAt),
    startsAt: seed.startsAt,
    endsAt: seed.endsAt,
    role: normalizeRole(seed.role),
    organizerId: undefined,
    organizerName: seed.organizerName,
    organizerInitials: seed.organizerInitials,
    organizerTone: seed.organizerTone,
    organizerAvatarSrc: undefined,
    description: seed.description ?? '',
    location: seed.location,
    savedCount: seed.savedCount,
    totalCount: seed.totalCount,
    coverStart: seed.coverStart,
    coverEnd: seed.coverEnd,
    backgroundStart: seed.coverStart,
    backgroundEnd: seed.coverEnd,
    accent: seed.accent,
    allowGuestInvites: false,
    participantLimit: null,
    infoBlocks: [],
    payment: null,
    timezoneLabel: 'Екатеринбург (UTC+5)',
    achievements: seed.achievements.map((achievement) => normalizeSeedAchievement(achievement)),
    photos,
    chatMessages: buildSeedChatMessages({
      organizerName: seed.organizerName,
      photos,
      startsAt: seed.startsAt,
    }),
    guestRsvps: [],
    titleStyle: 'classic',
    rsvpStyle: 'icons',
  })
}

export function getMockHomeEvents(): GalleryEvent[] {
  return homeEventSeeds.map((event) => normalizeSeedEvent(event))
}
