<script setup lang="ts">
// Страница события: детали, RSVP, альбом, чат и достижения (или preview для организатора).
import { useEventGallery } from '../composables/eventGalleryContext'

const app = useEventGallery()
</script>

<template>
  <main
    class="event-page-shell"
    :class="[
      { 'is-preview': app.currentView === 'preview' },
      app.getEventTextThemeClassForEvent(app.eventPageData),
      app.getEventBackgroundScrimClassForEvent(app.eventPageData),
    ]"
  >
    <div
      v-if="app.eventPageData"
      class="event-page-background"
      :style="app.getEventSurfaceStyle(app.eventPageData.backgroundStart, app.eventPageData.backgroundEnd)"
    >
      <video
        v-if="app.isVideoBackground(app.eventPageData)"
        class="event-page-background-video"
        :src="app.eventPageData.backgroundStart"
        autoplay
        muted
        loop
        playsinline
      ></video>
    </div>

    <header class="event-page-topbar">
      <a class="brand home-brand" href="#" aria-label="Галерея событий" @click.prevent="app.currentView === 'preview' ? app.closeGuestPreview() : app.closeEventPage()">
        <span class="brand-mark">EG</span>
        <span>Галерея событий</span>
      </a>

      <div v-if="app.currentView === 'preview'" class="event-page-mode-banner">
        <span>Просмотр события</span>
        <button class="secondary-button compact-action" type="button" @click="app.closeGuestPreview">Назад</button>
        <button class="primary-button compact-action" type="button" @click="app.saveEvent">Сохранить событие</button>
      </div>
      <div v-else class="event-page-top-actions">
        <button
          v-if="app.isCurrentUserOrganizer(app.activeEvent)"
          class="secondary-button compact-action"
          type="button"
          @click="app.activeEvent ? app.openEditEvent(app.activeEvent.id) : undefined"
        >
          Изменить
        </button>
        <button class="secondary-button compact-action" type="button" @click="app.closeEventPage">На главную</button>
      </div>
    </header>

    <section v-if="app.eventPageData" class="event-page-stage">
      <div class="event-page-layout">
        <div class="event-page-main">
          <h1 class="event-page-title" :class="app.getTitleStyleClass(app.eventPageData.titleStyle || 'classic')">
            {{ app.eventPageData.title }}
          </h1>
          <p class="event-page-meta">
            {{ app.formatEventDateLabel(app.eventPageData.startsAt) }}
            <span v-if="app.eventPageData.timezoneLabel"> · {{ app.eventPageData.timezoneLabel }}</span>
          </p>
          <p class="event-page-location">📍 {{ app.eventPageData.location }}</p>
          <div class="event-page-host">
            <span
              class="organizer-avatar"
              :class="{ filled: Boolean(app.eventPageData.organizerAvatarSrc) }"
              :style="app.getAvatarStyle(app.eventPageData.organizerAvatarSrc)"
            >
              {{ app.eventPageData.organizerAvatarSrc ? '' : app.eventPageData.organizerInitials }}
            </span>
            <span>Проводит {{ app.eventPageData.organizerName }}</span>
          </div>

          <section
            v-if="app.hasEventDetails(app.eventPageData)"
            class="event-page-section event-page-details event-text-surface"
          >
            <div class="event-page-section-head">
              <strong>О событии</strong>
            </div>

            <p v-if="app.eventPageData.description?.trim()" class="event-page-description">
              {{ app.eventPageData.description }}
            </p>

            <ul v-if="app.eventPageData.infoBlocks?.length" class="event-info-list">
              <li v-for="block in app.eventPageData.infoBlocks" :key="block.id" class="event-info-item">
                <span class="event-info-icon">{{ block.icon }}</span>
                <div class="event-info-copy">
                  <strong>{{ app.getInfoBlockLabel(block) }}</strong>
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

            <article v-if="app.hasEventPayment(app.eventPageData)" class="event-payment-card">
              <div class="event-info-copy">
                <strong>💸 Платное участие</strong>
                <p v-if="app.eventPageData.payment?.amount?.trim()">
                  С человека: {{ app.eventPageData.payment.amount }}
                </p>
                <p v-if="app.eventPageData.payment?.destination?.trim()">
                  Куда переводить: {{ app.eventPageData.payment.destination }}
                </p>
                <p v-if="app.eventPageData.payment?.comment?.trim()">
                  {{ app.eventPageData.payment.comment }}
                </p>
              </div>
            </article>
          </section>

          <section
            v-if="app.currentView !== 'preview' && app.canShowEventInvite(app.eventPageData)"
            class="event-page-section event-page-invite-card event-text-surface"
          >
            <div class="event-page-section-head">
              <strong>Приглашение</strong>
              <button class="secondary-button compact-action" type="button" @click="app.copyInviteLink(app.eventPageData)">
                Скопировать ссылку
              </button>
            </div>
            <p class="event-page-section-copy">
              Код приглашения: <strong>{{ app.eventPageData.inviteCode }}</strong>
            </p>
            <code class="event-invite-link">{{ app.getEventInviteUrl(app.eventPageData) }}</code>
            <p v-if="app.inviteLinkStatus" class="event-invite-status">{{ app.inviteLinkStatus }}</p>
          </section>

          <section v-if="app.currentView === 'preview'" class="event-page-section">
            <div class="event-page-section-head">
              <strong>Список гостей</strong>
              <span class="event-page-section-note">Пример предпросмотра</span>
            </div>
            <p class="event-page-section-copy">3 пойдут · 1 возможно</p>
          </section>

          <template v-else>
            <section class="event-page-section event-text-surface">
              <div class="event-page-section-head">
                <strong>Список гостей</strong>
                <span v-if="app.eventPageData.participantLimit" class="event-page-section-note">
                  лимит {{ app.eventPageData.participantLimit }}
                </span>
              </div>
              <p class="event-page-section-copy">
                {{ app.getRsvpSummary(app.eventPageData).going }} пойдут ·
                {{ app.getRsvpSummary(app.eventPageData).maybe }} возможно ·
                {{ app.getRsvpSummary(app.eventPageData).cant }} не смогут
                <span v-if="app.eventPageData.participantLimit">
                  · {{ app.getRsvpSummary(app.eventPageData).going }} / {{ app.eventPageData.participantLimit }} мест
                </span>
              </p>
              <div v-if="app.getGoingRsvpEntries(app.eventPageData).length" class="event-page-avatar-row">
                <button
                  v-for="entry in app.getGoingRsvpEntries(app.eventPageData)"
                  :key="entry.id"
                  type="button"
                  class="guest-avatar-chip guest-avatar-chip-button"
                  :class="{
                    filled: Boolean(app.getRsvpEntryAvatarUrl(entry, app.eventPageData.id)),
                    selected: app.highlightedGuestRsvpId === entry.id,
                  }"
                  :style="app.getAvatarStyle(app.getRsvpEntryAvatarUrl(entry, app.eventPageData.id))"
                  :aria-label="app.getRsvpEntryDisplayName(entry, app.eventPageData.id)"
                  :aria-pressed="app.highlightedGuestRsvpId === entry.id"
                  @click="app.toggleHighlightedGuest(entry.id)"
                >
                  {{ app.getRsvpEntryAvatarUrl(entry, app.eventPageData.id) ? '' : app.getRsvpEntryInitials(entry, app.eventPageData.id) }}
                </button>
              </div>
              <p v-else class="event-page-section-copy event-guest-list-empty">Пока никто не отметил «Пойду».</p>
              <p v-if="app.highlightedGuestRsvpEntry" class="guest-list-selected-name">
                {{ app.getRsvpEntryDisplayName(app.highlightedGuestRsvpEntry, app.eventPageData.id) }}
              </p>
            </section>

            <section class="event-page-section event-text-surface">
              <div class="event-page-section-head">
                <strong>Фотоальбом</strong>
                <span>{{ app.eventPageData.photos.length }} фото</span>
              </div>
              <div class="event-album-grid">
                <button
                  class="event-album-add-tile"
                  type="button"
                  aria-label="Добавить фото из файлов"
                  @click="app.triggerAlbumPhotoPicker(app.eventPageData.id)"
                >
                  <span class="event-album-add-icon">+</span>
                  <span>Добавить фото</span>
                </button>
                <button
                  v-for="photo in app.eventPageData.photos"
                  :key="photo.id"
                  class="event-album-photo"
                  type="button"
                  :style="app.getPhotoThumbToneStyle(photo)"
                  :aria-label="`Открыть фото ${app.eventPageData.title}`"
                  @click="app.openPhoto(app.eventPageData, photo, true)"
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
            </section>

            <section class="event-page-section event-text-surface">
              <div class="event-page-section-head">
                <strong>Активность</strong>
                <span>{{ app.formatChatMessageCount(app.eventPageData.chatMessages.length) }}</span>
              </div>
              <div class="event-chat-feed">
                <article v-for="message in app.eventPageData.chatMessages" :key="message.id" class="event-chat-item">
                  <span
                    class="guest-avatar-chip"
                    :class="{ filled: Boolean(app.getMessageAuthorAvatarUrl(message, app.eventPageData.id)) }"
                    :style="app.getAvatarStyle(app.getMessageAuthorAvatarUrl(message, app.eventPageData.id))"
                  >
                    {{ app.getMessageAuthorAvatarUrl(message, app.eventPageData.id) ? '' : app.getMessageAuthorInitials(message, app.eventPageData.id) }}
                  </span>
                  <div class="event-chat-copy">
                    <strong>{{ app.getMessageAuthorName(message, app.eventPageData.id) }}</strong>
                    <p>{{ message.text }}</p>
                    <button
                      v-if="
                        app.getEventPhotoById(app.eventPageData, message.photoId) &&
                        app.getPhotoImageSource(app.getEventPhotoById(app.eventPageData, message.photoId)!)
                      "
                      class="event-chat-photo-link"
                      type="button"
                      @click="
                        app.openPhoto(
                          app.eventPageData,
                          app.getEventPhotoById(app.eventPageData, message.photoId)!,
                          true,
                        )
                      "
                    >
                      <img
                        :src="app.getPhotoImageSource(app.getEventPhotoById(app.eventPageData, message.photoId)!)"
                        alt="Фото из чата"
                        decoding="async"
                      />
                    </button>
                  </div>
                </article>
              </div>
              <form class="event-chat-composer" @submit.prevent="app.sendEventChatMessage">
                <button
                  class="event-attach-button"
                  type="button"
                  aria-label="Прикрепить фото"
                  @click="app.triggerChatPhotoPicker"
                >
                  📎
                </button>
                <input v-model="app.eventChatDraft" type="text" placeholder="Написать в чат события..." />
                <button class="primary-button compact-action" type="submit">Отправить</button>
              </form>
            </section>
          </template>
        </div>

        <aside class="event-page-side">
          <div class="event-page-poster">
            <img
              v-if="app.isAssetSource(app.eventPageData.coverStart)"
              :src="app.eventPageData.coverStart"
              :alt="app.eventPageData.title"
              decoding="async"
            />
            <div
              v-else
              class="event-page-poster-fallback"
              :style="app.getEventSurfaceStyle(app.eventPageData.coverStart, app.eventPageData.coverEnd)"
            ></div>
          </div>

          <p
            v-if="app.eventPageData.participantLimit && app.isEventAtCapacity(app.eventPageData)"
            class="event-page-section-copy event-capacity-full"
          >
            Все места заняты. Можно ответить «Возможно» или «Не смогу».
          </p>

          <div class="rsvp-action-list" :data-style="app.eventPageData.rsvpStyle || 'icons'">
            <button
              v-for="choice in app.getRsvpChoices(app.eventPageData.rsvpStyle || 'icons')"
              :key="choice.id"
              class="rsvp-action-button"
              :class="{
                disabled: app.currentView === 'preview' || app.isGoingRsvpBlockedForEvent(app.eventPageData, choice.id),
                selected: app.getCurrentUserRsvpStatus(app.eventPageData) === choice.id,
              }"
              type="button"
              :disabled="app.currentView === 'preview' || app.isGoingRsvpBlockedForEvent(app.eventPageData, choice.id)"
              @click="app.openRsvpSheet(choice.id)"
            >
              <span class="rsvp-action-symbol">{{ choice.symbol }}</span>
              <span class="rsvp-action-label">{{ choice.label }}</span>
            </button>
          </div>

          <section
            v-if="app.currentView !== 'preview'"
            class="event-achievements-panel"
            :class="{ organizer: app.isCurrentUserOrganizer(app.activeEvent) }"
          >
            <button class="event-achievements-toggle" type="button" @click="app.achievementsPanelOpen = !app.achievementsPanelOpen">
              <span class="event-achievements-toggle-main">
                {{ app.isCurrentUserOrganizer(app.activeEvent) ? '🏅 Управление достижениями' : `🏅 Достижения ${app.getAchievementSummaryText(app.eventPageData)}` }}
              </span>
              <span
                v-if="!app.isCurrentUserOrganizer(app.activeEvent) && app.getHiddenAchievementCount(app.eventPageData) > 0"
                class="event-achievements-toggle-sub"
              >
                Скрытых: {{ app.getHiddenAchievementCount(app.eventPageData) }}
              </span>
            </button>

            <div v-if="app.achievementsPanelOpen" class="event-achievements-body">
              <p class="event-achievements-summary">{{ app.getAchievementSummaryText(app.eventPageData) }}</p>

              <div class="event-achievements-progress">
                <span
                  class="event-achievements-progress-fill"
                  :style="{ width: `${app.getAchievementProgressPercent(app.eventPageData)}%` }"
                ></span>
              </div>

              <div class="event-achievements-list">
                <article
                  v-for="achievement in app.getVisibleEventAchievements(app.eventPageData)"
                  :key="achievement.id"
                  class="event-achievement-card"
                  :class="{
                    'is-unlocked': app.isAchievementVisuallyEmphasized(achievement),
                    'is-hint':
                      app.getNormalizedAchievementVisibility(achievement) === 'hint' &&
                      !app.isAchievementUnlockedForCurrentParticipant(achievement),
                    'is-hidden':
                      app.getNormalizedAchievementVisibility(achievement) === 'hidden' &&
                      !app.isAchievementUnlockedForCurrentParticipant(achievement),
                  }"
                  :style="app.getAchievementToneStyle(achievement)"
                >
                  <button class="event-achievement-main" type="button" @click="app.toggleEventAchievementDetails(achievement.id)">
                    <span class="event-achievement-icon">
                      {{ app.getAchievementCardIcon(achievement) }}
                    </span>
                    <div class="event-achievement-info">
                      <div class="event-achievement-title-row">
                        <strong>{{ app.getAchievementCardTitle(achievement) }}</strong>
                        <span
                          v-if="app.isCurrentUserOrganizer(app.activeEvent)"
                          class="event-achievement-visibility-badge"
                          :data-visibility="app.getNormalizedAchievementVisibility(achievement)"
                        >
                          {{ app.getAchievementVisibilityBadge(achievement) }}
                        </span>
                      </div>
                      <small>{{ app.getAchievementAudienceLabel(app.eventPageData.id, achievement) }}</small>
                    </div>
                  </button>
                  <div v-if="app.isAchievementDetailsOpen(achievement.id)" class="event-achievement-details">
                    <p>{{ app.getAchievementCardDescription(achievement) }}</p>
                    <div v-if="app.isCurrentUserOrganizer(app.activeEvent)" class="event-achievement-actions">
                      <button
                        class="secondary-button compact-action"
                        type="button"
                        @click="app.openAchievementAwardModal(achievement)"
                      >
                        Выдать
                      </button>
                    </div>
                  </div>
                </article>

                <article
                  v-if="!app.isCurrentUserOrganizer(app.activeEvent) && app.getHiddenAchievementCount(app.eventPageData) > 0"
                  class="event-achievement-card event-achievement-card-placeholder"
                >
                  <span class="event-achievement-icon">🔒</span>
                  <div class="event-achievement-info">
                    <strong>Скрытых достижений: {{ app.getHiddenAchievementCount(app.eventPageData) }}</strong>
                    <small>Они раскроются только после получения.</small>
                  </div>
                </article>

                <p v-if="!app.eventPageData.achievements.length" class="event-achievement-empty">
                  Здесь появятся достижения события после настройки организатором.
                </p>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </section>
  </main>
</template>
