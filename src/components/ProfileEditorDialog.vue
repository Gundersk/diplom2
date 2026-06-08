<script setup lang="ts">
// Диалог редактирования глобального профиля: имя и аватар аккаунта.
import { useEventGallery } from '../composables/eventGalleryContext'

const app = useEventGallery()
</script>

<template>
  <div v-if="app.profileEditorOpen" class="auth-backdrop" @click.self="app.closeProfileEditor">
    <section class="auth-dialog profile-editor-dialog" aria-modal="true" role="dialog" aria-labelledby="profile-title">
      <button class="close-button" type="button" aria-label="Закрыть" @click="app.closeProfileEditor">×</button>

      <p class="eyebrow">Профиль</p>
      <h2 id="profile-title">Имя и аватар</h2>
      <p class="auth-subtitle">Глобальное имя аккаунта редактируется отдельно от имени участника внутри конкретного события.</p>

      <form class="auth-form" @submit.prevent="app.saveProfileEditor">
        <div class="profile-editor-avatar-row">
          <span
            class="profile-editor-avatar"
            :class="{ filled: Boolean(app.profileEditorAvatarPreviewUrl) }"
            :style="app.getAvatarStyle(app.profileEditorAvatarPreviewUrl || undefined)"
          >
            {{ app.profileEditorAvatarPreviewUrl ? '' : app.buildUserInitials(app.profileEditorName || app.currentUser.name) }}
          </span>
          <div class="profile-editor-copy">
            <strong>Аватар профиля</strong>
            <span>PNG, JPEG или WEBP до 2 МБ</span>
            <button class="secondary-button" type="button" @click="app.triggerProfileAvatarPicker">
              Загрузить изображение
            </button>
          </div>
        </div>

        <label>
          Имя
          <input
            v-model="app.profileEditorName"
            :maxlength="app.USER_NAME_MAX_LENGTH"
            type="text"
            placeholder="Как показывать вас в профиле"
            autocomplete="name"
          />
        </label>

        <div class="create-actions">
          <button class="secondary-button" type="button" @click="app.closeProfileEditor">Отмена</button>
          <button class="primary-button" type="submit">Сохранить</button>
        </div>
      </form>
      <p v-if="app.profileEditorError" class="auth-subtitle">{{ app.profileEditorError }}</p>
    </section>
  </div>
</template>
