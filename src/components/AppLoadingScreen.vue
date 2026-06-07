<script setup lang="ts">
import { useEventGallery } from '../composables/eventGalleryContext'

const app = useEventGallery()
</script>

<template>
  <main
    class="app-loading-screen"
    aria-live="polite"
    aria-busy="true"
    aria-label="Загрузка приложения"
  >
    <div class="app-loading-card">
      <span class="app-loading-mark">EG</span>
      <strong>Event Gallery</strong>
      <p>Восстанавливаем профиль и события…</p>
      <span class="app-loading-spinner" aria-hidden="true"></span>
    </div>
  </main>
</template>
