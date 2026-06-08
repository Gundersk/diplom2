<script setup lang="ts">
// Полноэкранный просмотр фото: листание, сохранение, фон события.
import { computed } from 'vue'
import { useEventGallery } from '../composables/eventGalleryContext'

const app = useEventGallery()
// Пара «событие + фото» из контекста; null скрывает оверлей.
const activePhotoEntry = computed(() => app.activePhotoEntry)
</script>

<template>
  <div
    v-if="activePhotoEntry"
    class="photo-viewer"
    :class="[
      { 'is-home': app.photoViewerMode === 'home', 'is-event-album': app.photoViewerMode === 'event-album' },
      app.getEventTextThemeClassForEvent(activePhotoEntry.event),
    ]"
    @click="app.handlePhotoViewerBackdropClick"
  >
    <img
      v-if="app.viewerEventBackgroundImage"
      class="photo-viewer-bg-fade"
      :src="app.viewerEventBackgroundImage"
      alt=""
      aria-hidden="true"
    />
    <div
      v-else-if="app.viewerEventBackgroundGradient"
      class="photo-viewer-bg-fade photo-viewer-bg-fade--gradient"
      :style="app.getEventSurfaceStyle(activePhotoEntry.event.backgroundStart, activePhotoEntry.event.backgroundEnd)"
      aria-hidden="true"
    ></div>

    <button
      class="viewer-edge viewer-edge--prev"
      type="button"
      aria-label="Предыдущее фото"
      @click.stop="app.stepPhoto(-1)"
    >
      <span class="viewer-edge-icon" aria-hidden="true">‹</span>
    </button>

    <section class="photo-viewer-stage" aria-label="Просмотр фото">
      <figure class="viewer-figure">
        <img
          v-if="app.getPhotoImageSource(activePhotoEntry.photo)"
          class="viewer-image"
          :src="app.getPhotoImageSource(activePhotoEntry.photo)"
          :alt="app.photoViewerMode === 'home' ? activePhotoEntry.event.title : 'Фото события'"
          decoding="async"
          draggable="true"
        />
        <div
          v-else
          class="viewer-image-fallback"
          :style="{ '--photo-tone': activePhotoEntry.photo.tone }"
        ></div>
      </figure>

      <div class="viewer-meta">
        <template v-if="app.photoViewerMode === 'home'">
          <p class="viewer-meta-title">{{ activePhotoEntry.event.title }}</p>
          <p class="viewer-meta-line">{{ app.formatPhotoPostedLabel(activePhotoEntry.photo) }}</p>
        </template>
        <p v-else class="viewer-meta-line">
          {{ app.getPhotoAuthorLabel(activePhotoEntry.photo) }} ·
          {{ app.formatPhotoPostedLabel(activePhotoEntry.photo) }}
        </p>
        <button
          class="viewer-save-button"
          type="button"
          @click.stop="app.togglePhotoSaved(activePhotoEntry.event.id, activePhotoEntry.photo.id)"
        >
          {{
            app.isPhotoSaved(activePhotoEntry.event.id, activePhotoEntry.photo.id)
              ? 'Убрать из сохранённых'
              : 'Сохранить'
          }}
        </button>
      </div>
    </section>

    <button
      class="viewer-edge viewer-edge--next"
      type="button"
      aria-label="Следующее фото"
      @click.stop="app.stepPhoto(1)"
    >
      <span class="viewer-edge-icon" aria-hidden="true">›</span>
    </button>
  </div>
</template>
