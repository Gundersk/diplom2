<script setup lang="ts">
import { computed, ref } from 'vue'

type AuthMode = 'guest' | 'profile'
type ViewMode = 'landing' | 'home'
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

type EventAchievement = {
  id: string
  title: string
  description: string
  icon: string
  tone: string
}

type GalleryEvent = {
  id: string
  title: string
  date: string
  status: EventTab
  sortOrder: number
  role: 'Участник' | 'Организатор'
  organizerName: string
  organizerInitials: string
  organizerTone: string
  location: string
  savedCount: number
  totalCount: number
  coverStart: string
  coverEnd: string
  accent: string
  achievements: EventAchievement[]
  photos: GalleryPhoto[]
}

type HomeNotification = {
  id: string
  title: string
  text: string
  time: string
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

const homeEvents: GalleryEvent[] = [
  {
    id: 'campus-night',
    title: 'Фото-вечер у кампуса',
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
        icon: '◉',
        tone: '#ff4d6d,#ffd166',
      },
      {
        id: 'first-frame',
        title: 'Первый кадр',
        description: 'Получает участник, который первым загрузил фото после открытия альбома.',
        icon: '◇',
        tone: '#41d3bd,#5b8def',
      },
      {
        id: 'group-shot',
        title: 'Общий кадр',
        description: 'Групповое достижение события: в альбоме появился снимок всей компании.',
        icon: '△',
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
        icon: '◎',
        tone: '#5b8def,#f7f06d',
      },
      {
        id: 'collector',
        title: 'Коллекционер',
        description: 'Получает участник, который сохранил фото из разных частей события.',
        icon: '□',
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
        icon: '○',
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
        icon: '△',
        tone: '#5b8def,#ff4d6d',
      },
      {
        id: 'top-like',
        title: 'Топ лайков',
        description: 'Выдается за фотографию, которая стала самой популярной в альбоме.',
        icon: '◎',
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
        icon: '◇',
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
        icon: '◉',
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
        icon: '△',
        tone: '#8a5cf6,#ffb703',
      },
      {
        id: 'active-guest',
        title: 'Активный гость',
        description: 'Выдается гостю, который чаще других реагировал на фото и сообщения.',
        icon: '○',
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
        icon: '◇',
        tone: '#5b8def,#ffffff',
      },
      {
        id: 'memory-keeper',
        title: 'Хранитель',
        description: 'Личная медаль за сохранение большого числа фотографий из события.',
        icon: '□',
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
        icon: '◎',
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

const notifications: HomeNotification[] = [
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
    time: '1 ч',
  },
]

const selectedTheme = ref<EventTheme>(themes[0])
const authOpen = ref(false)
const authMode = ref<AuthMode>('guest')
const currentView = ref<ViewMode>('landing')
const activeTab = ref<EventTab>('current')
const profileMenuOpen = ref(false)
const notificationsOpen = ref(false)
const expandedEvents = ref<Set<string>>(new Set())
const selectedPhoto = ref<{ eventId: string; photoId: string } | null>(null)
const activeAchievement = ref<string | null>(null)

const eventStyle = computed(() => ({
  '--theme-start': selectedTheme.value.start,
  '--theme-mid': selectedTheme.value.mid,
  '--theme-end': selectedTheme.value.end,
  '--theme-accent': selectedTheme.value.accent,
  '--theme-ink': selectedTheme.value.ink,
}))

const visibleEvents = computed(() =>
  [...homeEvents]
    .filter((event) => event.status === activeTab.value)
    .sort((first, second) => first.sortOrder - second.sortOrder),
)

const totalSavedPhotos = computed(() => homeEvents.reduce((sum, event) => sum + event.savedCount, 0))
const totalMedals = computed(() =>
  homeEvents.reduce((sum, event) => sum + event.achievements.length, 0),
)

const flatPhotos = computed(() =>
  homeEvents.flatMap((event) => event.photos.map((photo) => ({ event, photo }))),
)

const allVisibleExpanded = computed(
  () =>
    visibleEvents.value.length > 0 &&
    visibleEvents.value.every((event) => expandedEvents.value.has(event.id)),
)

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

  <main v-else class="home-shell">
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
        <button class="primary-button compact" type="button">Создать событие</button>
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
          :style="{
            '--event-start': event.coverStart,
            '--event-end': event.coverEnd,
            '--event-accent': event.accent,
            '--organizer-tone': event.organizerTone,
          }"
        >
          <button
            v-if="!isEventExpanded(event.id)"
            class="event-compact"
            type="button"
            @click="toggleEvent(event.id)"
          >
            <span class="event-role">{{ event.role }}</span>
            <span class="event-date">{{ event.date }}</span>
            <span class="event-sun" aria-hidden="true"></span>
            <span class="event-compact-title">{{ event.title }}</span>
            <span class="event-organizer">
              <span class="organizer-avatar">{{ event.organizerInitials }}</span>
              {{ event.organizerName }}
            </span>
          </button>

          <div v-else class="event-expanded">
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
                  {{ event.date }} · {{ event.location }} · организует {{ event.organizerName }}
                </p>
              </div>
              <button class="collapse-event-button" type="button" @click="toggleEvent(event.id)">
                Скрыть
              </button>
            </div>

            <div class="event-photo-gallery">
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
          </div>
        </article>
      </section>
    </section>
  </main>

  <div v-if="authOpen" class="auth-backdrop" @click.self="authOpen = false">
    <section class="auth-dialog" aria-modal="true" role="dialog" aria-labelledby="auth-title">
      <button class="close-button" type="button" aria-label="Закрыть" @click="authOpen = false">
        ×
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
      '--event-start': activePhotoEntry.event.coverStart,
      '--event-end': activePhotoEntry.event.coverEnd,
      '--photo-tone': activePhotoEntry.photo.tone,
    }"
    @click.self="closePhoto"
  >
    <section class="photo-viewer-card" aria-label="Просмотр фото">
      <button class="viewer-close" type="button" aria-label="Закрыть" @click="closePhoto">×</button>
      <div class="viewer-photo"></div>
      <div class="viewer-info">
        <span>{{ activePhotoEntry.event.title }}</span>
        <h3>Фото из события</h3>
        <p>{{ activePhotoEntry.photo.likes }} лайков · фон меняется вместе с событием</p>
      </div>
      <div class="viewer-actions">
        <button class="secondary-button" type="button" @click="stepPhoto(-1)">Назад</button>
        <button class="primary-button" type="button" @click="stepPhoto(1)">Дальше</button>
      </div>
    </section>
  </div>
</template>
