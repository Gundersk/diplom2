<script setup lang="ts">
// Нижняя панель RSVP: выбор статуса, сообщение организатору и отправка ответа.
import { useEventGallery } from '../composables/eventGalleryContext'

const app = useEventGallery()
</script>

<template>
  <div v-if="app.rsvpSheetOpen && app.rsvpSheetStatus" class="rsvp-sheet-overlay" @click.self="app.closeRsvpSheet">
    <section class="rsvp-sheet" aria-modal="true" role="dialog" aria-labelledby="rsvp-sheet-title">
      <div class="rsvp-sheet-preview-row">
        <button
          v-for="choice in app.getRsvpChoices(app.activeEvent?.rsvpStyle || 'icons')"
          :key="`sheet-${choice.id}`"
          class="rsvp-sheet-choice"
          :class="{
            active: app.rsvpSheetStatus === choice.id,
            disabled: app.isGoingRsvpBlockedForEvent(app.activeEvent, choice.id),
          }"
          type="button"
          :disabled="app.isGoingRsvpBlockedForEvent(app.activeEvent, choice.id)"
          @click="app.selectRsvpSheetStatus(choice.id)"
        >
          <span class="rsvp-action-symbol">{{ choice.symbol }}</span>
          <span class="rsvp-action-label">{{ choice.label }}</span>
        </button>
      </div>

      <div class="rsvp-sheet-user">
        <span class="rsvp-sheet-user-label">Отвечаете как</span>
        <span
          class="guest-avatar-chip"
          :class="{ filled: Boolean(app.getCurrentAuthorAvatarUrl(app.currentParticipant)) }"
          :style="app.getAvatarStyle(app.getCurrentAuthorAvatarUrl(app.currentParticipant), app.getAvatarCacheToken(app.currentParticipant))"
        >
          {{
            app.getCurrentAuthorAvatarUrl(app.currentParticipant)
              ? ''
              : app.currentParticipant
                ? app.buildUserInitials(app.currentParticipant.displayName)
                : app.currentUser.initials
          }}
        </span>
        <strong>{{ app.currentParticipant?.displayName || app.currentUser.name }}</strong>
      </div>

      <label class="rsvp-sheet-message">
        <span>+ Добавить сообщение</span>
        <textarea
          v-model="app.rsvpSheetMessage"
          rows="3"
          placeholder="Напишите организатору..."
        ></textarea>
      </label>

      <div class="rsvp-sheet-actions">
        <button class="ghost-button" type="button" @click="app.closeRsvpSheet">Отмена</button>
        <button class="primary-button" type="button" @click="app.submitRsvpResponse">Отправить</button>
      </div>
    </section>
  </div>
</template>
