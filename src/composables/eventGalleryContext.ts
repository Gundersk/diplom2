/**
 * Provide/inject для состояния приложения.
 * Дочерние view и компоненты получают app через useEventGallery() без prop drilling.
 */
import type { InjectionKey } from 'vue'
import { inject, provide } from 'vue'
import type { useEventGalleryApp } from './useEventGalleryApp'

export type EventGalleryApp = ReturnType<typeof useEventGalleryApp>

export const eventGalleryAppKey: InjectionKey<EventGalleryApp> = Symbol('eventGalleryApp')

export function provideEventGalleryApp(app: EventGalleryApp) {
  provide(eventGalleryAppKey, app)
}

export function useEventGallery() {
  const app = inject(eventGalleryAppKey)
  if (!app) {
    throw new Error('Контекст Event Gallery не найден — компонент вне App.vue')
  }
  return app
}
