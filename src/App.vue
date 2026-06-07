<script setup lang="ts">
import { useEventGalleryApp } from './composables/useEventGalleryApp'
import { provideEventGalleryApp } from './composables/eventGalleryContext'
import AppLoadingScreen from './components/AppLoadingScreen.vue'
import HomeView from './views/HomeView.vue'
import EventPageView from './views/EventPageView.vue'
import CreateEventView from './views/CreateEventView.vue'
import AchievementAwardModal from './components/AchievementAwardModal.vue'
import AuthDialog from './components/AuthDialog.vue'
import ProfileEditorDialog from './components/ProfileEditorDialog.vue'
import AppFileInputs from './components/AppFileInputs.vue'
import RsvpSheet from './components/RsvpSheet.vue'
import PhotoViewer from './components/PhotoViewer.vue'
import CreateAchievementPopover from './components/CreateAchievementPopover.vue'

const app = useEventGalleryApp()
provideEventGalleryApp(app)
</script>

<template>
  <AppLoadingScreen v-if="app.appInitializing" />

  <template v-else>
    <HomeView v-if="app.currentView === 'home'" />
    <EventPageView v-else-if="app.currentView === 'preview' || app.currentView === 'event'" />
    <CreateEventView v-else />
    <AchievementAwardModal />
    <AuthDialog />
    <ProfileEditorDialog />
    <AppFileInputs />
    <RsvpSheet />
    <PhotoViewer />
  </template>

  <CreateAchievementPopover />
</template>
