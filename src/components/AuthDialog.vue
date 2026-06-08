<script setup lang="ts">
// Модальное окно входа: гостевой режим или авторизация по email с кодом.
import { useEventGallery } from '../composables/eventGalleryContext'

const app = useEventGallery()
</script>

<template>
  <div v-if="app.authOpen" class="auth-backdrop" @click.self="app.authOpen = false">
    <section class="auth-dialog" aria-modal="true" role="dialog" aria-labelledby="auth-title">
      <button class="close-button" type="button" aria-label="Закрыть" @click="app.authOpen = false">×</button>

      <p class="eyebrow">Галерея событий</p>
      <h2 id="auth-title">Вход</h2>
      <p class="auth-subtitle">
        Гостевой вход — самый быстрый способ попасть на событие. Профиль по email сохраняет сессию: после входа вы остаётесь авторизованы, пока не нажмёте «Выйти».
      </p>
      <p v-if="app.pendingInviteCode" class="auth-hint">Вы заходите по приглашению <strong>{{ app.pendingInviteCode }}</strong>.</p>

      <div class="auth-tabs" role="tablist" aria-label="Способ входа">
        <button
          type="button"
          role="tab"
          :aria-selected="app.authMode === 'guest'"
          :class="{ active: app.authMode === 'guest' }"
          @click="app.authMode = 'guest'"
        >
          Войти как гость
        </button>
        <button
          type="button"
          role="tab"
          :aria-selected="app.authMode === 'profile'"
          :class="{ active: app.authMode === 'profile' }"
          @click="app.authMode = 'profile'"
        >
          Войти по email
        </button>
      </div>

      <form class="auth-form" @submit.prevent="app.completeAuth">
        <template v-if="app.authMode === 'guest'">
          <label>
            Имя участника
            <input
              v-model="app.authGuestName"
              type="text"
              placeholder="Например, Аня"
              autocomplete="name"
              :maxlength="app.USER_NAME_MAX_LENGTH"
            />
          </label>
          <p class="auth-hint">Если поле пустое, приложение создаст имя вроде “Гость 4821”. Выход из гостевого аккаунта удаляет его данные из этой сессии.</p>
          <button class="primary-button full" type="submit">Продолжить</button>
        </template>

        <template v-else>
          <label>
            Email
            <input
              v-model="app.authEmail"
              type="email"
              placeholder="student@example.ru"
              autocomplete="email"
            />
          </label>
          <button class="secondary-button full" type="button" @click="app.requestAuthCode">
            Получить код
          </button>
          <label>
            Код подтверждения
            <input
              v-model="app.authCode"
              type="text"
              placeholder="000000"
              autocomplete="one-time-code"
            />
          </label>
          <p v-if="app.authEmailCodeRequested && app.authEmailDelivery === 'appwrite'" class="auth-hint">
            Код запрошен для <strong>{{ app.authEmail }}</strong>. Смотрите
            <a href="http://localhost:8025" target="_blank" rel="noreferrer">Mailpit</a>
            (не Gmail) — письмо может прийти с задержкой 5–10 сек. Повторный запрос — не чаще раза в минуту.
          </p>
          <p v-else-if="app.authEmailCodeRequested && app.authEmailDelivery === 'local-dev'" class="auth-hint">
            Режим <strong>local</strong>: письмо не отправляется. Используйте код <strong>000000</strong>.
          </p>
          <p v-else class="auth-hint">Сначала получите код на email, затем подтвердите вход.</p>
          <p class="auth-hint">
            Если вы были гостем, новые события перенесутся в профиль. Имя и аватар профиля сохранятся, если аккаунт уже существует.
          </p>
          <button class="primary-button full" type="submit">
            {{ app.currentUser.mode === 'guest' || app.currentUser.mode === 'demo' ? 'Создать профиль' : 'Войти' }}
          </button>
        </template>
      </form>
      <p v-if="app.authError" class="auth-subtitle">{{ app.authError }}</p>
    </section>
  </div>
</template>
