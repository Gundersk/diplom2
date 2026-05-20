<script setup lang="ts">
import { computed, ref } from 'vue'

type AuthMode = 'guest' | 'profile'
type ViewMode = 'landing' | 'home' | 'create'
type EventTab = 'current' | 'upcoming' | 'past'

type EventTheme = {
  id: string
  name: string
  mood: string
  emoji: string
  start: string
  mid: string
  end: string
  accent: string
  ink: string
}

type GalleryPhoto = {
  id: string
  tone: string
  likes: number
}

type EventInfoBlockType =
  | 'dress-code'
  | 'playlist'
  | 'bring'
  | 'link'
  | 'schedule'
  | 'payment'
  | 'other'

type EventInfoBlock = {
  id: string
  type: EventInfoBlockType
  icon: string
  title: string
  description: string
  link: string
}

type EventPaymentInfo = {
  amount: string
  destination: string
  comment: string
}

type AchievementScope = 'personal' | 'group'
type AchievementMode = 'automatic' | 'manual'

type EventAchievement = {
  id: string
  title: string
  description: string
  icon: string
  tone: string
  scope: AchievementScope
  mode: AchievementMode
  conditionType?: 'first_photo' | 'most_photos' | 'most_likes'
}

type GalleryEvent = {
  id: string
  title: string
  status: EventTab
  startsAt: string
  endsAt: string
  role: 'Участник' | 'Организатор'
  organizerName: string
  organizerInitials: string
  organizerTone: string
  organizerAvatarSrc?: string
  description?: string
  location: string
  savedCount: number
  totalCount: number
  coverStart: string
  coverEnd: string
  backgroundStart: string
  backgroundEnd: string
  accent: string
  allowGuestInvites?: boolean
  participantLimit?: null | number
  infoBlocks?: EventInfoBlock[]
  payment?: EventPaymentInfo | null
  timezoneLabel?: string
  achievements: EventAchievement[]
  photos: GalleryPhoto[]
}

type HomeNotification = {
  id: string
  title: string
  text: string
  time: string
}

type AchievementTemplate = {
  id: string
  title: string
  description: string
  scope: AchievementScope
  mode: AchievementMode
  conditionType?: 'first_photo' | 'most_photos' | 'most_likes'
  icon: string
  tone: string
  isSystem: boolean
}

type CreateEventForm = {
  title: string
  titleStyle: string
  description: string
  startDate: string
  startHour: string
  startMinute: string
  endDate: string
  endHour: string
  endMinute: string
  timezone: string
  hostAlias: string
  location: string
  participantLimit: string
  coverAssetId: string
  backgroundAssetId: string
  backgroundMode: 'asset' | 'color'
  backgroundColor: string
  paymentEnabled: boolean
  costPerPerson: string
  uploadedCoverUrl: null | string
  uploadedBackgroundUrl: null | string
  infoBlocks: EventInfoBlock[]
  paymentDestination: string
  paymentComment: string
  allowGuestInvites: boolean
  rsvpStyle: string
  automaticExpanded: boolean
  personalExpanded: boolean
  groupExpanded: boolean
  automaticTemplateIds: string[]
  selectedPersonalTemplateIds: string[]
  selectedGroupTemplateIds: string[]
}

type MedalForm = {
  title: string
  description: string
  scope: AchievementScope
  icon: string
  tone: string
  saveAsTemplate: boolean
}

type AssetOption = {
  id: string
  kind: 'image' | 'video'
  label: string
  src: string
  category?: 'gif' | 'poster'
}

type TimezoneOption = {
  id: string
  label: string
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

const homeEventSeeds = [
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

const systemAchievementTemplates: AchievementTemplate[] = [
  {
    id: 'first-frame',
    title: 'Первый кадр',
    description: 'Выдается участнику, который первым загрузил фото в общий альбом события.',
    scope: 'personal',
    mode: 'automatic',
    conditionType: 'first_photo',
    icon: '📸',
    tone: '#41d3bd,#5b8def',
    isSystem: true,
  },
  {
    id: 'paparazzi',
    title: 'Папарацци',
    description: 'Выдается участнику, который добавил больше всех фото в общий альбом.',
    scope: 'personal',
    mode: 'automatic',
    conditionType: 'most_photos',
    icon: '📷',
    tone: '#ff7a59,#ffd166',
    isSystem: true,
  },
  {
    id: 'king-of-likes',
    title: 'Король лайков',
    description: 'Выдается участнику, чьи фотографии собрали больше всех лайков.',
    scope: 'personal',
    mode: 'automatic',
    conditionType: 'most_likes',
    icon: '⭐',
    tone: '#ffb703,#ffffff',
    isSystem: true,
  },
]

const customAchievementTemplates = ref<AchievementTemplate[]>([
  {
    id: 'template-best-look',
    title: 'Лучший образ',
    description: 'Организатор вручает участнику за самый выразительный образ события.',
    scope: 'personal',
    mode: 'manual',
    icon: '💎',
    tone: '#ff4d6d,#ffffff',
    isSystem: false,
  },
  {
    id: 'template-soul',
    title: 'Душа компании',
    description: 'Организатор вручает участнику, который лучше всех поддерживал атмосферу.',
    scope: 'personal',
    mode: 'manual',
    icon: '✨',
    tone: '#ffd166,#41d3bd',
    isSystem: false,
  },
  {
    id: 'template-everyone',
    title: 'Все отметились',
    description: 'Групповая медаль события: все гости подтвердили участие и появились на фото.',
    scope: 'group',
    mode: 'manual',
    icon: '👥',
    tone: '#5b8def,#f7f06d',
    isSystem: false,
  },
])

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

const currentUser = {
  initials: 'Ю',
  name: 'Юрий',
  role: 'Организатор' as const,
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

function isAssetSource(value: string) {
  return /\.(png|jpe?g|jfif|webp|avif|gif|mp4|webm)$/i.test(value)
}

function getCoverBackground(event: GalleryEvent) {
  if (isAssetSource(event.coverStart)) {
    return `linear-gradient(180deg, rgba(22, 22, 22, 0.08), rgba(22, 22, 22, 0.64)), url("${event.coverStart}")`
  }

  return `linear-gradient(180deg, rgba(22, 22, 22, 0.02), rgba(22, 22, 22, 0.62)), linear-gradient(135deg, ${event.coverStart}, ${event.coverEnd})`
}

function getBackgroundBackground(event: GalleryEvent) {
  if (isAssetSource(event.backgroundStart)) {
    return `linear-gradient(180deg, rgba(255, 255, 255, 0.12), rgba(22, 22, 22, 0.12)), url("${event.backgroundStart}")`
  }

  return `linear-gradient(180deg, rgba(255, 255, 255, 0.16), rgba(22, 22, 22, 0.08)), linear-gradient(135deg, ${event.backgroundStart}, ${event.backgroundEnd})`
}

function buildEventStatus(startsAt: string, endsAt: string) {
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

function buildAchievementFromTemplate(template: AchievementTemplate): EventAchievement {
  return {
    id: createId(template.id),
    title: template.title,
    description: template.description,
    icon: template.icon,
    tone: template.tone,
    scope: template.scope,
    mode: template.mode,
    conditionType: template.conditionType,
  }
}

function normalizeSeedAchievement(seedAchievement: {
  id: string
  title: string
  description: string
  icon: string
  tone: string
}) {
  const automaticById: Record<string, { conditionType: EventAchievement['conditionType']; mode: AchievementMode }> = {
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

  return {
    ...seedAchievement,
    scope: groupIds.has(seedAchievement.id) ? 'group' : 'personal',
    mode: automaticById[seedAchievement.id]?.mode ?? 'manual',
    conditionType: automaticById[seedAchievement.id]?.conditionType,
  } satisfies EventAchievement
}

function normalizeSeedEvent(seed: {
  accent: string
  achievements: Array<{
    description: string
    icon: string
    id: string
    title: string
    tone: string
  }>
  coverEnd: string
  coverStart: string
  endsAt: string
  id: string
  location: string
  organizerInitials: string
  organizerName: string
  organizerTone: string
  photos: GalleryPhoto[]
  role: string
  savedCount: number
  startsAt: string
  title: string
  totalCount: number
  description?: string
}) {
  return {
    id: seed.id,
    title: seed.title,
    status: buildEventStatus(seed.startsAt, seed.endsAt),
    startsAt: seed.startsAt,
    endsAt: seed.endsAt,
    role: seed.role === 'Организатор' || seed.role === 'Организатор' ? 'Организатор' : 'Участник',
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
    photos: seed.photos,
  } satisfies GalleryEvent
}

const selectedTheme = ref<EventTheme>(themes[0])
const homeEvents = ref<GalleryEvent[]>(homeEventSeeds.map((event) => normalizeSeedEvent(event)))
const authOpen = ref(false)
const authMode = ref<AuthMode>('guest')
const currentView = ref<ViewMode>('landing')
const activeTab = ref<EventTab>('current')
const profileMenuOpen = ref(false)
const notificationsOpen = ref(false)
const expandedEvents = ref<Set<string>>(new Set())
const selectedPhoto = ref<{ eventId: string; photoId: string } | null>(null)
const activeAchievement = ref<string | null>(null)
const createEventOpen = ref(false)
const medalBuilderOpen = ref(false)
const guestPreviewOpen = ref(false)
const coverPickerOpen = ref(false)
const coverSearchQuery = ref('')
const createAchievementPopover = ref<string | null>(null)
const createEventForm = ref<CreateEventForm>(createEmptyEventForm())
const medalForm = ref<MedalForm>(createEmptyMedalForm())

const hourOptions = Array.from({ length: 24 }, (_, index) => padNumber(index))
const minuteOptions = Array.from({ length: 60 }, (_, index) => padNumber(index))
const todayDate = new Date().toISOString().slice(0, 10)

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

const flatPhotos = computed(() =>
  homeEvents.value.flatMap((event) => event.photos.map((photo) => ({ event, photo }))),
)

const allVisibleExpanded = computed(
  () =>
    visibleEvents.value.length > 0 &&
    visibleEvents.value.every((event) => expandedEvents.value.has(event.id)),
)

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

const selectedBackgroundAsset = computed(() =>
  createEventForm.value.backgroundMode === 'asset' && createEventForm.value.uploadedBackgroundUrl
    ? {
        id: 'uploaded-background',
        kind: 'image' as const,
        label: 'Свой фон',
        src: createEventForm.value.uploadedBackgroundUrl,
      }
    : createEventForm.value.backgroundMode === 'asset'
      ? getAssetById(backgroundAssetOptions, createEventForm.value.backgroundAssetId)
      : null,
)

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

const startIsInPast = computed(() => new Date(startDateTime.value).getTime() < Date.now())
const endBeforeStart = computed(() => new Date(endDateTime.value).getTime() < new Date(startDateTime.value).getTime())

const selectedAutomaticTemplates = computed(() =>
  systemAchievementTemplates.filter((template) => createEventForm.value.automaticTemplateIds.includes(template.id)),
)

const selectedPersonalTemplates = computed(() =>
  customAchievementTemplates.value.filter(
    (template) =>
      template.scope === 'personal' &&
      createEventForm.value.selectedPersonalTemplateIds.includes(template.id),
  ),
)

const selectedGroupTemplates = computed(() =>
  customAchievementTemplates.value.filter(
    (template) =>
      template.scope === 'group' &&
      createEventForm.value.selectedGroupTemplateIds.includes(template.id),
  ),
)

const availableAutomaticTemplates = computed(() =>
  systemAchievementTemplates.filter((template) => !createEventForm.value.automaticTemplateIds.includes(template.id)),
)

const availablePersonalTemplates = computed(() =>
  customAchievementTemplates.value.filter(
    (template) =>
      template.scope === 'personal' &&
      !createEventForm.value.selectedPersonalTemplateIds.includes(template.id),
  ),
)

const availableGroupTemplates = computed(() =>
  customAchievementTemplates.value.filter(
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

const createBackgroundStyle = computed(() => {
  if (createEventForm.value.backgroundMode === 'color') {
    return {
      backgroundImage: buildSoftColorGradient(createEventForm.value.backgroundColor),
    }
  }

  if (selectedBackgroundAsset.value?.kind === 'image') {
    return {
      backgroundImage: `linear-gradient(135deg, rgba(255, 255, 255, 0.18), rgba(255, 255, 255, 0.22)), url("${selectedBackgroundAsset.value.src}")`,
    }
  }

  return {
    backgroundImage: buildSoftColorGradient('#e6dcff'),
  }
})

const previewBackgroundStyle = computed(() => {
  if (createEventForm.value.backgroundMode === 'color') {
    return { backgroundImage: buildSoftColorGradient(createEventForm.value.backgroundColor) }
  }

  if (selectedBackgroundAsset.value?.kind === 'image') {
    return {
      backgroundImage: `linear-gradient(180deg, rgba(255, 255, 255, 0.42), rgba(255, 255, 255, 0.78)), url("${selectedBackgroundAsset.value.src}")`,
    }
  }

  return { backgroundImage: buildSoftColorGradient('#e6dcff') }
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

function openAuth(mode: AuthMode) {
  authMode.value = mode
  authOpen.value = true
}

function completeAuth() {
  currentView.value = 'home'
  authOpen.value = false
  profileMenuOpen.value = false
  notificationsOpen.value = false
}

function logout() {
  currentView.value = 'landing'
  profileMenuOpen.value = false
  notificationsOpen.value = false
  selectedPhoto.value = null
  createEventOpen.value = false
  medalBuilderOpen.value = false
  guestPreviewOpen.value = false
  coverPickerOpen.value = false
  createAchievementPopover.value = null
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

function openCreateEvent() {
  createEventForm.value = createEmptyEventForm()
  medalForm.value = createEmptyMedalForm()
  currentView.value = 'create'
  createEventOpen.value = true
  medalBuilderOpen.value = false
  guestPreviewOpen.value = false
  coverPickerOpen.value = false
  coverSearchQuery.value = ''
  createAchievementPopover.value = null
  notificationsOpen.value = false
  profileMenuOpen.value = false
}

function closeCreateEvent() {
  currentView.value = 'home'
  createEventOpen.value = false
  medalBuilderOpen.value = false
  guestPreviewOpen.value = false
  coverPickerOpen.value = false
  createAchievementPopover.value = null
}

function addInfoBlock() {
  createEventForm.value.infoBlocks.push(createEmptyInfoBlock())
}

function removeInfoBlock(blockId: string) {
  createEventForm.value.infoBlocks = createEventForm.value.infoBlocks.filter(
    (block) => block.id !== blockId,
  )
}

function openMedalBuilder(scope: AchievementScope) {
  medalForm.value = createEmptyMedalForm()
  medalForm.value.scope = scope
  medalBuilderOpen.value = true
}

function saveCustomMedal() {
  const trimmedTitle = medalForm.value.title.trim()
  const trimmedDescription = medalForm.value.description.trim()
  if (!trimmedTitle || !trimmedDescription) return

  const newTemplate: AchievementTemplate = {
    id: createId('template'),
    title: trimmedTitle,
    description: trimmedDescription,
    scope: medalForm.value.scope,
    mode: 'manual',
    icon: medalForm.value.icon.trim() || '🏅',
    tone: medalForm.value.tone,
    isSystem: false,
  }

  customAchievementTemplates.value = [newTemplate, ...customAchievementTemplates.value]
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

function toggleEvent(id: string) {
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
    visibleEvents.value.forEach((event) => next.delete(event.id))
    activeAchievement.value = null
  } else {
    visibleEvents.value.forEach((event) => next.add(event.id))
  }
  expandedEvents.value = next
}

function openPhoto(event: GalleryEvent, photo: GalleryPhoto) {
  selectedPhoto.value = { eventId: event.id, photoId: photo.id }
}

function closePhoto() {
  selectedPhoto.value = null
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

function deleteTemplate(templateId: string) {
  const template = customAchievementTemplates.value.find((item) => item.id === templateId)
  if (!template) return
  if (!window.confirm(`Удалить шаблон достижения "${template.title}"?`)) return

  customAchievementTemplates.value = customAchievementTemplates.value.filter(
    (item) => item.id !== templateId,
  )
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

function scrollToCreateSection(sectionId: string) {
  document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function handleCoverUpload(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file) {
    createEventForm.value.uploadedCoverUrl = window.URL.createObjectURL(file)
    coverPickerOpen.value = false
  }
}

function handleBackgroundUpload(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file) {
    createEventForm.value.backgroundMode = 'asset'
    createEventForm.value.uploadedBackgroundUrl = window.URL.createObjectURL(file)
  }
}

function createEventFromForm() {
  const coverAsset = selectedCoverAsset.value
  const backgroundAsset = selectedBackgroundAsset.value
  const safeStartsAt = startDateTime.value
  const safeEndsAt = endBeforeStart.value ? startDateTime.value : endDateTime.value
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
    backgroundStart:
      createEventForm.value.backgroundMode === 'color'
        ? createEventForm.value.backgroundColor
        : backgroundAsset?.src ?? '#f8f7f2',
    backgroundEnd:
      createEventForm.value.backgroundMode === 'color'
        ? '#fffaf6'
        : backgroundAsset?.src ?? '#ffffff',
    accent: '#ff7a59',
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
  }

  return newEvent
}

function saveEvent() {
  if (!createEventForm.value.title.trim() || !createEventForm.value.startDate) return
  if (startIsInPast.value) return

  const nextEvent = createEventFromForm()
  homeEvents.value = [...homeEvents.value, nextEvent]
  expandedEvents.value = new Set([nextEvent.id])
  activeTab.value = nextEvent.status
  activeAchievement.value = null
  createEventOpen.value = false
  medalBuilderOpen.value = false
  guestPreviewOpen.value = false
  coverPickerOpen.value = false
  currentView.value = 'home'
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
          <span class="profile-avatar">Ю</span>
          <span>Юрий</span>
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
        <button type="button">Изменить имя</button>
        <button type="button">Изменить аватар</button>
        <button type="button" @click="logout">Выйти</button>
      </section>
    </header>

    <section class="home-workspace" aria-labelledby="events-title">
      <div class="home-section-head">
        <div>
          <p class="eyebrow">Личная галерея</p>
          <h1 id="events-title">Мои события</h1>
        </div>
        <button class="secondary-button" type="button" @click="toggleAllEvents">
          {{ allVisibleExpanded ? 'Свернуть все события' : 'Раскрыть все события' }}
        </button>
      </div>

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
          <button
            v-if="!isEventExpanded(event.id)"
            class="event-compact"
            type="button"
            :style="{ backgroundImage: getCoverBackground(event) }"
            @click="toggleEvent(event.id)"
          >
            <span class="event-role">{{ event.role }}</span>
            <span class="event-date">{{ formatEventDateLabel(event.startsAt) }}</span>
            <span class="event-sun" aria-hidden="true"></span>
            <span class="event-compact-title">{{ event.title }}</span>
            <span class="event-organizer">
              <span
                class="organizer-avatar"
                :style="
                  event.organizerAvatarSrc
                    ? { backgroundImage: `url(${event.organizerAvatarSrc})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                    : undefined
                "
              >
                <template v-if="!event.organizerAvatarSrc">{{ event.organizerInitials }}</template>
              </span>
              {{ event.organizerName }}
            </span>
            <span class="event-badge-summary">
              <span>🏆 {{ countAchievements(event, 'group') }}</span>
              <span>🏅 {{ countAchievements(event, 'personal') }}</span>
            </span>
          </button>

          <div v-else class="event-expanded" :style="{ backgroundImage: getBackgroundBackground(event) }">
            <div class="expanded-achievements" aria-label="Достижения события">
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
              <div>
                <span class="event-role">{{ event.role }}</span>
                <h2>{{ event.title }}</h2>
                <p>
                  {{ formatEventDateLabel(event.startsAt) }} · {{ event.location }} · организует
                  {{ event.organizerName }}
                </p>
              </div>
              <button class="collapse-event-button" type="button" @click="toggleEvent(event.id)">
                Скрыть
              </button>
            </div>

            <div v-if="event.photos.length" class="event-photo-gallery">
              <button
                v-for="photo in event.photos"
                :key="photo.id"
                class="gallery-photo"
                type="button"
                :style="{ '--photo-tone': photo.tone }"
                :aria-label="`Открыть фото события ${event.title}`"
                @click="openPhoto(event, photo)"
              ></button>
            </div>
            <div v-else class="event-photo-empty">
              <strong>Фотографии появятся после события</strong>
              <p>После загрузки снимков общий альбом автоматически свяжется с этой карточкой.</p>
            </div>
          </div>
        </article>
      </section>
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
                <input v-model="createEventForm.startDate" :min="todayDate" type="date" required />
              </label>
              <div class="time-select-card">
                <span>Время начала</span>
                <div class="time-select-row">
                  <select v-model="createEventForm.startHour" class="time-select">
                    <option v-for="hour in hourOptions" :key="`start-hour-${hour}`" :value="hour">{{ hour }}</option>
                  </select>
                  <span class="time-divider">:</span>
                  <select v-model="createEventForm.startMinute" class="time-select">
                    <option v-for="minute in minuteOptions" :key="`start-minute-${minute}`" :value="minute">
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
                    <option v-for="hour in hourOptions" :key="`end-hour-${hour}`" :value="hour">{{ hour }}</option>
                  </select>
                  <span class="time-divider">:</span>
                  <select v-model="createEventForm.endMinute" class="time-select">
                    <option v-for="minute in minuteOptions" :key="`end-minute-${minute}`" :value="minute">
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
                  <span class="stream-avatar">{{ currentUser.initials }}</span>
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
              Начало события нельзя поставить в прошлое относительно текущего времени.
            </p>
            <p v-else-if="endBeforeStart" class="validation-note">
              Время окончания сейчас раньше начала. При сохранении оно будет выровнено по началу.
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
          <button class="primary-button" :disabled="startIsInPast" type="submit">Добавить событие</button>
        </div>
      </form>

      <aside class="create-side-stage">
        <section id="create-cover" class="cover-stage">
          <button class="cover-change-button" type="button" @click="coverPickerOpen = true">
            <template v-if="selectedCoverAsset">
              <img class="cover-stage-image" :src="selectedCoverAsset.src" :alt="selectedCoverAsset.label" />
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
          <div class="rsvp-preview-row" :data-style="createEventForm.rsvpStyle">
            <div
              v-for="(symbol, index) in getRsvpPreviewSymbols(createEventForm.rsvpStyle)"
              :key="`${createEventForm.rsvpStyle}-${index}`"
              class="rsvp-preview-bubble"
            >
              {{ symbol }}
            </div>
          </div>
          <div class="rsvp-label-row">
            <span>Going</span>
            <span>Maybe</span>
            <span>Can't Go</span>
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
                @click="createEventForm.backgroundMode = 'asset'"
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
                @click="createEventForm.backgroundAssetId = asset.id; createEventForm.uploadedBackgroundUrl = null"
              >
                <template v-if="asset.kind === 'image'">
                  <img :src="asset.src" :alt="asset.label" />
                </template>
                <template v-else>
                  <video :src="asset.src" muted autoplay loop playsinline></video>
                </template>
              </button>
            </div>
            <div v-else class="color-swatch-row">
              <button
                v-for="color in softBackgroundColors"
                :key="color"
                class="color-swatch"
                :class="{ active: createEventForm.backgroundColor === color }"
                :style="{ background: buildSoftColorGradient(color) }"
                type="button"
                @click="createEventForm.backgroundColor = color"
              ></button>
            </div>
            <label v-if="createEventForm.backgroundMode === 'asset'" class="upload-chip small">
              Свой фон
              <input
                type="file"
                accept="image/*"
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
        <button class="side-action-button" type="button" @click="guestPreviewOpen = true">
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

        <div v-if="filteredCoverPosters.length" class="cover-picker-section">
          <div class="cover-picker-label">Постеры</div>
          <div class="cover-picker-grid">
            <button
              v-for="asset in filteredCoverPosters"
              :key="asset.id"
              class="cover-picker-tile"
              :class="{ active: createEventForm.coverAssetId === asset.id && !createEventForm.uploadedCoverUrl }"
              type="button"
              @click="createEventForm.coverAssetId = asset.id; createEventForm.uploadedCoverUrl = null; coverPickerOpen = false"
            >
              <img :src="asset.src" :alt="asset.label" />
            </button>
          </div>
        </div>

        <div v-if="filteredCoverGifs.length" class="cover-picker-section">
          <div class="cover-picker-label">GIF</div>
          <div class="cover-picker-grid">
            <button
              v-for="asset in filteredCoverGifs"
              :key="asset.id"
              class="cover-picker-tile"
              :class="{ active: createEventForm.coverAssetId === asset.id && !createEventForm.uploadedCoverUrl }"
              type="button"
              @click="createEventForm.coverAssetId = asset.id; createEventForm.uploadedCoverUrl = null; coverPickerOpen = false"
            >
              <img :src="asset.src" :alt="asset.label" />
            </button>
          </div>
        </div>

        <label class="cover-upload-tile">
          Загрузить свою обложку
          <input type="file" accept="image/*,.gif" hidden @change="handleCoverUpload" />
        </label>
      </section>
    </div>

    <div v-if="guestPreviewOpen" class="guest-preview-overlay" @click.self="guestPreviewOpen = false">
      <section class="guest-preview-sheet" aria-modal="true" role="dialog" aria-labelledby="guest-preview-title">
        <div class="guest-preview-background" :style="previewBackgroundStyle">
          <video
            v-if="createEventForm.backgroundMode === 'asset' && selectedBackgroundAsset?.kind === 'video'"
            class="guest-preview-video"
            :src="selectedBackgroundAsset.src"
            autoplay
            muted
            loop
            playsinline
          ></video>
        </div>
        <button class="ghost-inline-button preview-close-button" type="button" @click="guestPreviewOpen = false">
          ×
        </button>
        <div class="guest-preview-cover">
          <img
            v-if="selectedCoverAsset?.kind === 'image'"
            :src="selectedCoverAsset.src"
            :alt="selectedCoverAsset.label"
          />
        </div>
        <div class="guest-preview-copy">
          <p class="eyebrow">Preview</p>
          <h2 id="guest-preview-title" class="guest-preview-title" :class="getTitleStyleClass(createEventForm.titleStyle)">
            {{ createEventForm.title || 'Untitled Event' }}
          </h2>
          <p>{{ previewDateLabel }} · {{ previewTimezoneLabel }} · {{ createEventForm.location || 'Location' }}</p>
          <p v-if="createEventForm.description">{{ createEventForm.description }}</p>
        </div>
        <div v-if="createEventForm.infoBlocks.length" class="guest-preview-tags">
          <span v-for="block in createEventForm.infoBlocks" :key="block.id" class="guest-preview-tag">
            {{ block.icon }} {{ block.title || 'Ссылка' }}
          </span>
        </div>
        <div class="guest-preview-rsvp">
          <div
            v-for="(symbol, index) in getRsvpPreviewSymbols(createEventForm.rsvpStyle)"
            :key="`preview-${index}`"
            class="rsvp-preview-bubble"
          >
            {{ symbol }}
          </div>
        </div>
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
          <div class="field-block field-span-2">
            <span>Emoji</span>
            <div class="emoji-picker-grid">
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
      <button class="close-button" type="button" aria-label="Закрыть" @click="authOpen = false">
        Г—
      </button>

      <p class="eyebrow">Event Gallery</p>
      <h2 id="auth-title">Вход в событие</h2>
      <p class="auth-subtitle">
        Для MVP основной сценарий начинается с гостевого входа, а профиль можно подключить
        позднее.
      </p>

      <div class="auth-tabs" role="tablist" aria-label="Способ входа">
        <button
          type="button"
          role="tab"
          :aria-selected="authMode === 'guest'"
          :class="{ active: authMode === 'guest' }"
          @click="authMode = 'guest'"
        >
          Гость
        </button>
        <button
          type="button"
          role="tab"
          :aria-selected="authMode === 'profile'"
          :class="{ active: authMode === 'profile' }"
          @click="authMode = 'profile'"
        >
          Профиль
        </button>
      </div>

      <form class="auth-form" @submit.prevent="completeAuth">
        <template v-if="authMode === 'guest'">
          <label>
            Код события
            <input type="text" placeholder="MAY-24" autocomplete="off" />
          </label>
          <label>
            Имя участника
            <input type="text" placeholder="Например, Аня" autocomplete="name" />
          </label>
          <button class="primary-button full" type="submit">Войти как гость</button>
        </template>

        <template v-else>
          <label>
            Email
            <input type="email" placeholder="student@example.ru" autocomplete="email" />
          </label>
          <label>
            Пароль
            <input type="password" placeholder="••••••••" autocomplete="current-password" />
          </label>
          <button class="primary-button full" type="submit">Войти в профиль</button>
        </template>
      </form>
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
      <button class="viewer-close" type="button" aria-label="Закрыть" @click="closePhoto">Г—</button>
      <div class="viewer-photo"></div>
      <div class="viewer-info">
        <span>{{ activePhotoEntry.event.title }}</span>
        <h3>Фото из события</h3>
        <p>
          {{ activePhotoEntry.photo.likes }} лайков · {{ formatEventDateLabel(activePhotoEntry.event.startsAt) }}
        </p>
      </div>
      <div class="viewer-actions">
        <button class="secondary-button" type="button" @click="stepPhoto(-1)">Назад</button>
        <button class="primary-button" type="button" @click="stepPhoto(1)">Дальше</button>
      </div>
    </section>
  </div>
</template>

