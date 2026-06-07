<script setup lang="ts">
import { useEventGallery } from '../composables/eventGalleryContext'

const app = useEventGallery()
</script>

<template>
  <input
    :ref="(element) => { app.albumPhotoInput = element as HTMLInputElement | null }"
    type="file"
    accept="image/*,.gif"
    hidden
    @change="app.handleAlbumPhotoUpload"
  />
  <input
    :ref="(element) => { app.chatPhotoInput = element as HTMLInputElement | null }"
    type="file"
    accept="image/*,.gif"
    hidden
    @change="app.handleChatPhotoUpload"
  />
  <input
    :ref="(element) => { app.profileAvatarInput = element as HTMLInputElement | null }"
    type="file"
    accept="image/png,image/jpeg,image/webp,image/gif,image/avif,image/jfif"
    hidden
    @change="app.handleProfileAvatarUpload"
  />
</template>
