<script setup lang="ts">
import { useEventGallery } from '../composables/eventGalleryContext'

const app = useEventGallery()
</script>

<template>
  <div
    v-if="app.achievementAwardModalOpen && app.achievementAwardTarget"
    class="event-achievement-modal"
    :class="
      app.getEventTextThemeClassForEvent(
        app.achievementAwardEventId ? app.getEventById(app.achievementAwardEventId) : app.activeEvent,
      )
    "
    @click.self="app.closeAchievementAwardModal"
  >
    <section class="event-achievement-modal-card" aria-modal="true" role="dialog" aria-labelledby="achievement-award-title">
      <div class="section-title-row">
        <div>
          <h3 id="achievement-award-title">{{ app.achievementAwardTarget.title }}</h3>
          <p>Выберите участников, которым нужно вручить достижение.</p>
        </div>
        <button class="ghost-inline-button" type="button" @click="app.closeAchievementAwardModal">Закрыть</button>
      </div>

      <div class="event-achievement-modal-list">
        <p v-if="!app.achievementAwardParticipants.length" class="event-achievement-empty">
          У события пока нет участников для выдачи достижения.
        </p>
        <label
          v-for="participant in app.achievementAwardParticipants"
          :key="participant.id"
          class="event-achievement-user-row"
        >
          <input
            type="checkbox"
            :checked="app.achievementAwardSelections.includes(participant.id)"
            @change="app.toggleAchievementAwardSelection(participant.id)"
          />
          <span
            class="guest-avatar-chip"
            :class="{ filled: Boolean(app.getParticipantAvatarUrl(participant)) }"
            :style="app.getAvatarStyle(app.getParticipantAvatarUrl(participant), app.getAvatarCacheToken(participant))"
          >
            {{ app.getParticipantAvatarUrl(participant) ? '' : app.buildUserInitials(participant.displayName) }}
          </span>
          <span class="event-achievement-user-copy">
            <strong>{{ app.getParticipantDisplayName(participant) }}</strong>
            <small>
              {{
                app.achievementAwardSelections.includes(participant.id)
                  ? app.isAchievementAlreadyAwardedToParticipant(app.achievementAwardTarget.id, participant.id)
                    ? 'Получено — снимите галочку, чтобы отозвать'
                    : 'Будет выдано'
                  : participant.role === 'organizer'
                    ? 'Организатор'
                    : 'Участник'
              }}
            </small>
          </span>
        </label>
      </div>

      <p v-if="app.achievementAwardError" class="event-achievement-error">{{ app.achievementAwardError }}</p>

      <div class="create-actions">
        <button class="secondary-button" type="button" @click="app.closeAchievementAwardModal">Отмена</button>
        <button class="primary-button" type="button" @click="app.submitAchievementAwards">Сохранить</button>
      </div>
    </section>
  </div>
</template>
