<script setup lang="ts">
import { computed, ref } from 'vue'

type AuthMode = 'guest' | 'profile'

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

const themes: EventTheme[] = [
  {
    id: 'sunset',
    name: 'Вечер',
    mood: 'тёплая встреча',
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

const selectedTheme = ref<EventTheme>(themes[0])
const authOpen = ref(false)
const authMode = ref<AuthMode>('guest')

const eventStyle = computed(() => ({
  '--theme-start': selectedTheme.value.start,
  '--theme-mid': selectedTheme.value.mid,
  '--theme-end': selectedTheme.value.end,
  '--theme-accent': selectedTheme.value.accent,
  '--theme-ink': selectedTheme.value.ink,
}))

function openAuth(mode: AuthMode) {
  authMode.value = mode
  authOpen.value = true
}
</script>

<template>
  <main class="app-shell" :style="eventStyle">
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

    <div v-if="authOpen" class="auth-backdrop" @click.self="authOpen = false">
      <section class="auth-dialog" aria-modal="true" role="dialog" aria-labelledby="auth-title">
        <button class="close-button" type="button" aria-label="Закрыть" @click="authOpen = false">
          ×
        </button>

        <p class="eyebrow">Event Gallery</p>
        <h2 id="auth-title">Вход в событие</h2>
        <p class="auth-subtitle">
          Для MVP основной сценарий начинается с гостевого входа, а профиль можно
          подключить позднее.
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

        <form class="auth-form" @submit.prevent>
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
  </main>
</template>
