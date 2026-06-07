<script setup lang="ts">
import { computed } from 'vue'
import { useEventGallery } from '../composables/eventGalleryContext'

const app = useEventGallery()
const popoverTemplate = computed(() => app.createAchievementPopoverTemplate)
</script>

<template>
  <Teleport to="body">
    <div
      v-if="app.createAchievementPopover && popoverTemplate"
      class="selected-pill-popover selected-pill-popover--floating"
      :style="app.createAchievementPopoverStyle"
      role="dialog"
      aria-modal="false"
      @click.stop
    >
      <strong>{{ popoverTemplate.title }}</strong>
      <p>{{ popoverTemplate.description }}</p>
      <div class="achievement-visibility-picker">
        <button
          class="ghost-inline-button"
          :class="{ active: app.getTemplateVisibility(popoverTemplate.id) === 'visible' }"
          type="button"
          @click="app.setTemplateVisibility(popoverTemplate.id, 'visible')"
        >
          Открытое
        </button>
        <button
          class="ghost-inline-button"
          :class="{ active: app.getTemplateVisibility(popoverTemplate.id) === 'hint' }"
          type="button"
          @click="app.setTemplateVisibility(popoverTemplate.id, 'hint')"
        >
          Скрыть условие
        </button>
        <button
          class="ghost-inline-button"
          :class="{ active: app.getTemplateVisibility(popoverTemplate.id) === 'hidden' }"
          type="button"
          @click="app.setTemplateVisibility(popoverTemplate.id, 'hidden')"
        >
          Скрыть полностью
        </button>
      </div>
    </div>
  </Teleport>
</template>
