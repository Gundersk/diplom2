import { ref, type Ref } from 'vue'
import { eventService } from '../services/eventService'
import type { EventTab, GalleryEvent } from '../types/event'
import {
  clearEventNavigationFromUrl,
  readEventIdFromLocation,
  readInviteCodeFromLocation,
} from '../utils/eventInviteNavigation'

type AuthMode = 'guest' | 'profile'

export type InviteFlowDeps = {
  currentView: Ref<'home' | 'create' | 'preview' | 'event'>
  activeTab: Ref<EventTab>
  authMode: Ref<AuthMode>
  authGuestName: Ref<string>
  authError: Ref<string>
  authOpen: Ref<boolean>
  hasRealAuthenticatedUser: () => boolean
  isAppwriteMode: () => boolean
  getEventById: (eventId: string) => GalleryEvent | null | undefined
  upsertHomeEvent: (event: GalleryEvent) => void
  openEventPage: (eventId: string, event?: GalleryEvent) => Promise<void>
  ensureCurrentParticipant: (event: GalleryEvent) => Promise<unknown>
  loadHomeEvents: () => Promise<unknown>
  refreshEventDataFromServices: (eventId: string) => Promise<unknown>
}

export function useInviteFlow(deps: InviteFlowDeps) {
  const pendingInviteCode = ref<string | null>(null)
  const pendingInviteEventId = ref<string | null>(null)
  const inviteErrorMessage = ref('')

  async function restoreEventPageFromUrl() {
    const eventId = readEventIdFromLocation()
    if (!eventId) {
      deps.currentView.value = 'home'
      return
    }

    if (deps.isAppwriteMode() && !deps.hasRealAuthenticatedUser()) {
      clearEventNavigationFromUrl()
      deps.currentView.value = 'home'
      return
    }

    let event = deps.getEventById(eventId)
    if (!event) {
      event = await eventService.getEventById(eventId)
    }

    if (!event) {
      clearEventNavigationFromUrl()
      inviteErrorMessage.value = 'Событие не найдено или у вас нет доступа.'
      deps.currentView.value = 'home'
      return
    }

    inviteErrorMessage.value = ''
    deps.upsertHomeEvent(event)
    deps.activeTab.value = event.status
    await deps.openEventPage(event.id, event)
  }

  async function resolveInviteFlow() {
    const inviteCode = readInviteCodeFromLocation()
    if (!inviteCode) {
      pendingInviteCode.value = null
      pendingInviteEventId.value = null
      inviteErrorMessage.value = ''
      return
    }

    pendingInviteCode.value = inviteCode

    if (deps.isAppwriteMode() && !deps.hasRealAuthenticatedUser()) {
      inviteErrorMessage.value = ''
      deps.authMode.value = 'guest'
      deps.authGuestName.value = ''
      deps.authError.value = ''
      deps.authOpen.value = true
      return
    }

    const event = await eventService.getEventByInviteCode(inviteCode)
    if (!event) {
      pendingInviteEventId.value = null
      inviteErrorMessage.value = `Событие с кодом ${inviteCode} не найдено.`
      deps.currentView.value = 'home'
      return
    }

    inviteErrorMessage.value = ''
    pendingInviteEventId.value = event.id
    eventService.cacheEventState(event)
    deps.upsertHomeEvent(event)
    deps.activeTab.value = event.status
    await deps.openEventPage(event.id, event)

    if (deps.hasRealAuthenticatedUser()) {
      const participant = await deps.ensureCurrentParticipant(event)
      if (participant) {
        await deps.loadHomeEvents()
        await deps.refreshEventDataFromServices(event.id)
      }
    }
  }

  function resetInviteFlowState() {
    pendingInviteCode.value = null
    pendingInviteEventId.value = null
    inviteErrorMessage.value = ''
  }

  return {
    pendingInviteCode,
    pendingInviteEventId,
    inviteErrorMessage,
    restoreEventPageFromUrl,
    resolveInviteFlow,
    resetInviteFlowState,
    readInviteCodeFromLocation,
  }
}
