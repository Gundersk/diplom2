/**
 * Переключатель режима данных Event Gallery (диплом).
 * VITE_DATA_MODE=local — localStorage + IndexedDB для медиа; appwrite — Appwrite Auth/DB/Storage.
 * Все сервисы ветвятся через isAppwriteMode() / isLocalMode().
 */
import { runtimeConfig } from '../../config/runtime'

export function getDataMode() {
  return runtimeConfig.dataMode
}

export function isLocalMode() {
  return getDataMode() === 'local'
}

export function isAppwriteMode() {
  return getDataMode() === 'appwrite'
}
