<script setup lang="ts">
import { useEventGallery } from '../composables/eventGalleryContext'

const app = useEventGallery()
</script>

<template>
  <main class="home-shell">
    <header class="home-topbar" aria-label="Навигация личного кабинета">
      <a class="brand home-brand" href="#" aria-label="Event Gallery Home">
        <span class="brand-mark">EG</span>
        <span>Event Gallery</span>
      </a>

      <div class="home-actions">
        <template v-if="app.hasRealAuthenticatedUser()">
          <button class="primary-button compact" type="button" @click="app.openCreateEvent">
            Создать событие
          </button>
          <button class="profile-button" type="button" @click="app.toggleProfileMenu">
            <span
              class="profile-avatar"
              :class="{ filled: app.hasCurrentUserAvatarVisual() }"
              :style="app.getAvatarStyle(app.getCurrentUserAvatarUrlForDocuments(), app.currentUser.avatarFileId || app.currentUser.updatedAt)"
            >
              {{ app.hasCurrentUserAvatarVisual() ? '' : app.currentUser.initials }}
            </span>
            <span>{{ app.currentUser.name }}</span>
          </button>
        </template>
        <template v-else>
          <button class="ghost-button" type="button" @click="app.openAuth('profile')">Войти</button>
          <button class="primary-button compact" type="button" @click="app.openAuth('guest')">
            Создать событие
          </button>
        </template>
      </div>

      <section v-if="app.hasRealAuthenticatedUser() && app.profileMenuOpen" class="profile-popover" aria-label="Меню профиля">
        <button type="button" @click="app.openProfileEditor('name')">Изменить имя</button>
        <button type="button" @click="app.openProfileEditor('avatar')">Изменить аватар</button>
        <button
          v-if="app.currentUser.mode === 'guest'"
          type="button"
          @click="app.openGuestProfileUpgrade"
        >
          Сохранить профиль
        </button>
        <button type="button" @click="app.logout">Выйти</button>
      </section>
    </header>

    <section class="home-workspace" aria-labelledby="events-title">
      <section
        v-if="app.showGuestPersistBanner"
        class="guest-persist-banner"
        aria-label="Подсказка для гостевого профиля"
      >
        <p>
          Вы вошли как гость. Сохраните профиль, чтобы не потерять события при смене браузера или
          устройства.
        </p>
        <div class="guest-persist-banner-actions">
          <button class="primary-button compact" type="button" @click="app.openGuestProfileUpgrade">
            Сохранить профиль
          </button>
          <button class="ghost-button compact" type="button" @click="app.dismissGuestPersistBanner">
            Позже
          </button>
        </div>
      </section>

      <div class="home-section-head">
        <div>
          <p class="eyebrow">Личная галерея</p>
          <h1 id="events-title">Мои события</h1>
        </div>
        <button
          v-if="app.expandableVisibleEvents.length"
          class="secondary-button"
          type="button"
          @click="app.toggleAllEvents"
        >
          {{ app.allVisibleExpanded ? 'Свернуть галерею' : 'Раскрыть сохранённые фото' }}
        </button>
      </div>

      <section v-if="app.inviteErrorMessage" class="invite-alert invite-alert-dark" aria-live="polite">
        <strong>Ссылка приглашения не сработала</strong>
        <p>{{ app.inviteErrorMessage }}</p>
      </section>

      <div v-if="app.homeEvents.length" class="event-tabs" aria-label="Фильтр событий">
        <button
          type="button"
          class="event-tab"
          :class="{ active: app.activeTab === 'past' }"
          @click="app.setActiveTab('past')"
        >
          Прошедшие
        </button>
        <button
          type="button"
          class="event-tab"
          :class="{ active: app.activeTab === 'current' }"
          @click="app.setActiveTab('current')"
        >
          Текущие
        </button>
        <button
          type="button"
          class="event-tab"
          :class="{ active: app.activeTab === 'upcoming' }"
          @click="app.setActiveTab('upcoming')"
        >
          Будущие
        </button>
      </div>

      <section v-if="!app.homeEvents.length" class="home-empty-state">
        <strong v-if="app.hasRealAuthenticatedUser()">Пока нет событий</strong>
        <strong v-else>Войдите, чтобы начать</strong>
        <p v-if="app.hasRealAuthenticatedUser()">
          Создайте первое событие или откройте приглашение по ссылке от организатора.
        </p>
        <p v-else>
          Войдите как гость или по email, чтобы создавать события и участвовать в них.
        </p>
        <div class="home-empty-actions">
          <button class="primary-button" type="button" @click="app.openCreateEvent">Создать событие</button>
          <button
            v-if="!app.hasRealAuthenticatedUser()"
            class="secondary-button"
            type="button"
            @click="app.openAuth('profile')"
          >
            Войти по email
          </button>
        </div>
      </section>

      <section v-else class="event-mosaic" aria-label="События в личной галерее">
        <article
          v-for="event in app.visibleEvents"
          :key="event.id"
          class="home-event-card"
          :class="{ expanded: app.isEventExpanded(event.id) }"
          :style="{ '--event-accent': event.accent, '--organizer-tone': event.organizerTone }"
        >
          <div v-if="!app.isEventExpanded(event.id)" class="event-compact-shell">
            <button
              class="event-compact"
              type="button"
              :style="app.getEventSurfaceStyle(event.coverStart, event.coverEnd)"
              @click="app.openEventPage(event.id)"
            >
              <span class="event-role">{{ event.role }}</span>
              <span class="event-date">{{ app.formatShortEventDate(event.startsAt) }}</span>
              <span class="event-compact-title">{{ event.title }}</span>
              <span class="event-organizer">
                <span
                  class="organizer-avatar"
                  :class="{ filled: Boolean(event.organizerAvatarSrc) }"
                  :style="app.getAvatarStyle(event.organizerAvatarSrc)"
                >
                  {{ event.organizerAvatarSrc ? '' : event.organizerInitials }}
                </span>
                <span class="event-organizer-name">{{ event.organizerName }}</span>
              </span>
            </button>
            <button
              v-if="app.canExpandOnHome(event)"
              class="event-expand-button"
              type="button"
              @click.stop="app.toggleEventExpanded(event.id)"
            >
              Раскрыть
            </button>
          </div>

          <div v-else class="event-expanded" :class="app.getEventTextThemeClassForEvent(event)" :style="app.getEventSurfaceStyle(event.backgroundStart, event.backgroundEnd)">
            <video
              v-if="app.isVideoBackground(event)"
              class="event-expanded-video"
              :src="event.backgroundStart"
              autoplay
              muted
              loop
              playsinline
            ></video>
            <div v-if="app.canShowHomeAchievements(event)" class="expanded-achievements" aria-label="Полученные достижения">
              <button
                v-for="achievement in app.getHomeAwardedAchievements(event)"
                :key="achievement.id"
                class="achievement-medal"
                :class="{ active: app.activeAchievement === app.getAchievementKey(event, achievement) }"
                :style="{ '--achievement-tone': achievement.tone }"
                type="button"
                @click="app.toggleAchievement(event, achievement)"
              >
                <span class="achievement-mark">{{ achievement.icon }}</span>
                <span>{{ achievement.title }}</span>
                <span
                  v-if="app.activeAchievement === app.getAchievementKey(event, achievement)"
                  class="achievement-popover"
                >
                  {{ achievement.description }}
                </span>
              </button>
            </div>

            <div class="expanded-event-head">
              <div class="expanded-event-copy">
                <div class="expanded-event-text">
                  <span class="event-role">{{ event.role }}</span>
                  <h2>{{ event.title }}</h2>
                  <p>
                    {{ app.formatEventDateLabel(event.startsAt) }} · {{ event.location }} · организует
                    <span class="expanded-organizer-name">{{ event.organizerName }}</span>
                  </p>
                </div>
                <div
                  class="expanded-cover-thumb"
                  :style="app.getEventSurfaceStyle(event.coverStart, event.coverEnd)"
                ></div>
              </div>
              <div class="expanded-event-actions">
                <button class="secondary-button compact-action" type="button" @click="app.openEventPage(event.id)">
                  Открыть событие
                </button>
                <button class="secondary-button compact-action" type="button" @click="app.copyInviteLink(event)">
                  Скопировать ссылку
                </button>
                <button class="collapse-event-button" type="button" @click="app.toggleEventExpanded(event.id)">
                  Свернуть
                </button>
              </div>
            </div>

            <div v-if="app.getSavedPhotos(event).length" class="event-photo-gallery">
              <button
                v-for="photo in app.getSavedPhotos(event)"
                :key="photo.id"
                class="gallery-photo"
                :class="{ saved: photo.saved }"
                type="button"
                :style="app.getPhotoThumbToneStyle(photo)"
                :aria-label="`Открыть сохранённое фото события ${event.title}`"
                @click="app.openPhoto(event, photo)"
              >
                <img
                  v-if="app.getPhotoImageSource(photo)"
                  class="photo-thumb-image"
                  :src="app.getPhotoImageSource(photo)"
                  alt=""
                  loading="lazy"
                  decoding="async"
                  draggable="true"
                />
              </button>
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
</template>
