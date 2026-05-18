<script setup lang="ts">
import { computed, ref } from 'vue'

type AuthMode = 'guest' | 'profile'
type ViewMode = 'landing' | 'home'
type EventTab = 'current' | 'upcoming' | 'past' | 'hosting'

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
  title: string
  tone: string
  likes: number
}

type GalleryEvent = {
  id: string
  title: string
  date: string
  status: EventTab
  role: 'Гость' | 'Организатор'
  location: string
  savedCount: number
  totalCount: number
  coverStart: string
  coverEnd: string
  accent: string
  invitePolicy: string
  payment?: string
  groupMedals: string[]
  personalMedals: string[]
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
    date: 'Сегодня, 18:30',
    status: 'current',
    role: 'Организатор',
    location: 'Учебный корпус, аудитория 214',
    savedCount: 18,
    totalCount: 126,
    coverStart: '#ff7a59',
    coverEnd: '#41d3bd',
    accent: '#ff4d6d',
    invitePolicy: 'Гости могут приглашать',
    payment: '300 ₽ на организацию, отметка вручную',
    groupMedals: ['50 фото собрано', 'Групповой кадр'],
    personalMedals: ['Папарацци', 'Фото вечера', 'Первый кадр'],
    photos: [
      { id: 'campus-1', title: 'Фото вечера', tone: '#ff7a59,#ffd166,#41d3bd', likes: 48 },
      { id: 'campus-2', title: 'Сохранено', tone: '#41d3bd,#5b8def,#ffffff', likes: 21 },
      { id: 'campus-3', title: 'Групповой кадр', tone: '#ff4d6d,#ffd166,#111111', likes: 36 },
      { id: 'campus-4', title: 'Папарацци', tone: '#151515,#8a5cf6,#ffb703', likes: 17 },
    ],
  },
  {
    id: 'grad-party',
    title: 'Выпускной проектный вечер',
    date: '24 мая, 19:00',
    status: 'upcoming',
    role: 'Гость',
    location: 'Лофт на набережной',
    savedCount: 9,
    totalCount: 74,
    coverStart: '#5b8def',
    coverEnd: '#f7f06d',
    accent: '#008f7a',
    invitePolicy: 'Только организатор приглашает',
    groupMedals: ['Все отметились'],
    personalMedals: ['Коллекционер моментов'],
    photos: [
      { id: 'grad-1', title: 'Сцена', tone: '#5b8def,#f7f06d,#00c2a8', likes: 15 },
      { id: 'grad-2', title: 'Друзья', tone: '#ffffff,#5b8def,#ff4d6d', likes: 29 },
      { id: 'grad-3', title: 'После защиты', tone: '#00c2a8,#f7f06d,#151515', likes: 33 },
    ],
  },
  {
    id: 'quest',
    title: 'Ночной квест',
    date: '12 апреля, завершено',
    status: 'past',
    role: 'Гость',
    location: 'Парк Гагарина',
    savedCount: 14,
    totalCount: 93,
    coverStart: '#151515',
    coverEnd: '#8a5cf6',
    accent: '#ffb703',
    invitePolicy: 'Архив события',
    groupMedals: ['Маршрут пройден'],
    personalMedals: ['Активный гость', 'Любимец альбома'],
    photos: [
      { id: 'quest-1', title: 'Старт', tone: '#151515,#8a5cf6,#ffb703', likes: 18 },
      { id: 'quest-2', title: 'Команда', tone: '#8a5cf6,#ffb703,#ffffff', likes: 41 },
      { id: 'quest-3', title: 'Финиш', tone: '#111111,#41d3bd,#8a5cf6', likes: 26 },
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
const allPhotosMode = ref(false)
const expandedEvents = ref<Set<string>>(new Set(['campus-night']))
const selectedPhoto = ref<{ eventId: string; photoId: string } | null>(null)

const eventStyle = computed(() => ({
  '--theme-start': selectedTheme.value.start,
  '--theme-mid': selectedTheme.value.mid,
  '--theme-end': selectedTheme.value.end,
  '--theme-accent': selectedTheme.value.accent,
  '--theme-ink': selectedTheme.value.ink,
}))

const filteredEvents = computed(() => homeEvents.filter((event) => event.status === activeTab.value))

const visibleEvents = computed(() =>
  activeTab.value === 'hosting'
    ? homeEvents.filter((event) => event.role === 'Организатор')
    : filteredEvents.value,
)

const totalSavedPhotos = computed(() => homeEvents.reduce((sum, event) => sum + event.savedCount, 0))
const totalMedals = computed(() =>
  homeEvents.reduce((sum, event) => sum + event.groupMedals.length + event.personalMedals.length, 0),
)

const flatPhotos = computed(() =>
  homeEvents.flatMap((event) => event.photos.map((photo) => ({ event, photo }))),
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

function isEventExpanded(id: string) {
  return allPhotosMode.value || expandedEvents.value.has(id)
}

function toggleEvent(id: string) {
  const next = new Set(expandedEvents.value)
  if (next.has(id)) {
    next.delete(id)
  } else {
    next.add(id)
  }
  expandedEvents.value = next
}

function toggleAllPhotos() {
  allPhotosMode.value = !allPhotosMode.value
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

    <section class="home-hero" aria-labelledby="home-title">
      <div class="home-hero-copy">
        <p class="hero-label">Личный кабинет</p>
        <h1 id="home-title">Мои события и сохраненные фото</h1>
        <p>
          Здесь события идут карточками, а сохраненные снимки раскрываются внутри своей
          визуальной истории: с фоном мероприятия, медальками и быстрым переходом в альбом.
        </p>
      </div>

      <div class="home-summary">
        <article>
          <strong>{{ homeEvents.length }}</strong>
          <span>события</span>
        </article>
        <article>
          <strong>{{ totalSavedPhotos }}</strong>
          <span>сохранено фото</span>
        </article>
        <article>
          <strong>{{ totalMedals }}</strong>
          <span>медалей</span>
        </article>
      </div>
    </section>

    <section class="home-workspace" aria-labelledby="events-title">
      <div class="home-section-head">
        <div>
          <p class="eyebrow">Гибридная галерея</p>
          <h2 id="events-title">События</h2>
        </div>
        <button class="secondary-button" type="button" @click="toggleAllPhotos">
          {{ allPhotosMode ? 'Свернуть фотоленту' : 'Раскрыть все фото' }}
        </button>
      </div>

      <div class="event-tabs" aria-label="Фильтр событий">
        <button
          type="button"
          class="event-tab"
          :class="{ active: activeTab === 'current' }"
          @click="activeTab = 'current'"
        >
          Текущие
        </button>
        <button
          type="button"
          class="event-tab"
          :class="{ active: activeTab === 'upcoming' }"
          @click="activeTab = 'upcoming'"
        >
          Будущие
        </button>
        <button
          type="button"
          class="event-tab"
          :class="{ active: activeTab === 'past' }"
          @click="activeTab = 'past'"
        >
          Прошедшие
        </button>
        <button
          type="button"
          class="event-tab"
          :class="{ active: activeTab === 'hosting' }"
          @click="activeTab = 'hosting'"
        >
          Организую
        </button>
      </div>

      <div class="home-grid">
        <section class="event-feed" aria-label="Карточки событий">
          <article
            v-for="event in visibleEvents"
            :key="event.id"
            class="home-event-card"
            :class="{ expanded: isEventExpanded(event.id) }"
            :style="{
              '--event-start': event.coverStart,
              '--event-end': event.coverEnd,
              '--event-accent': event.accent,
            }"
          >
            <div class="event-cover-block">
              <div class="event-cover-content">
                <div>
                  <span class="event-role">{{ event.role }}</span>
                  <h3>{{ event.title }}</h3>
                  <p>{{ event.date }} · {{ event.location }}</p>
                </div>
                <div class="event-metrics">
                  <span>{{ event.savedCount }} сохранено</span>
                  <span>{{ event.totalCount }} в общем альбоме</span>
                </div>
              </div>

              <div class="medal-area">
                <div v-if="event.groupMedals.length" class="group-medals">
                  <span v-for="medal in event.groupMedals" :key="medal">◇ {{ medal }}</span>
                </div>
                <div class="personal-medals">
                  <span v-for="medal in event.personalMedals" :key="medal">● {{ medal }}</span>
                </div>
              </div>
            </div>

            <div class="home-event-body">
              <div class="event-card-toolbar">
                <div>
                  <strong>{{ event.invitePolicy }}</strong>
                  <span v-if="event.payment">{{ event.payment }}</span>
                  <span v-else>Без отметки сбора средств</span>
                </div>
                <div class="event-card-actions">
                  <button class="secondary-button compact-action" type="button">Открыть событие</button>
                  <button class="primary-button compact-action" type="button" @click="toggleEvent(event.id)">
                    {{ isEventExpanded(event.id) ? 'Скрыть фото' : 'Раскрыть фото' }}
                  </button>
                </div>
              </div>

              <div v-if="isEventExpanded(event.id)" class="saved-photo-grid">
                <button
                  v-for="photo in event.photos"
                  :key="photo.id"
                  class="saved-photo"
                  type="button"
                  :style="{ '--photo-tone': photo.tone }"
                  @click="openPhoto(event, photo)"
                >
                  <span>{{ photo.title }}</span>
                  <small>{{ photo.likes }} лайков</small>
                </button>
              </div>
              <div v-else class="collapsed-preview" aria-label="Превью сохраненных фото">
                <span
                  v-for="photo in event.photos.slice(0, 3)"
                  :key="photo.id"
                  class="mini-photo"
                  :style="{ '--photo-tone': photo.tone }"
                ></span>
                <strong>+{{ Math.max(event.photos.length - 3, 0) }}</strong>
              </div>
            </div>
          </article>
        </section>

        <aside class="home-sidebar" aria-label="Сводка личной галереи">
          <article class="home-panel">
            <h3>Автоматические медали</h3>
            <p>В демо они работают как личные достижения и выдаются системой по простым правилам.</p>
            <div class="achievement-list">
              <span>Первый кадр</span>
              <span>Папарацци</span>
              <span>Любимец альбома</span>
              <span>Коллекционер моментов</span>
            </div>
          </article>

          <article class="home-panel">
            <h3>Событийный контекст</h3>
            <p>
              Фото из личной галереи не теряют связь с мероприятием: фон, медали и подписи
              подсказывают, откуда сохранен снимок.
            </p>
          </article>
        </aside>
      </div>
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
        <h3>{{ activePhotoEntry.photo.title }}</h3>
        <p>{{ activePhotoEntry.photo.likes }} лайков · фон меняется вместе с событием</p>
      </div>
      <div class="viewer-actions">
        <button class="secondary-button" type="button" @click="stepPhoto(-1)">Назад</button>
        <button class="primary-button" type="button" @click="stepPhoto(1)">Дальше</button>
      </div>
    </section>
  </div>
</template>
