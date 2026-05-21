import { runtimeConfig } from '../../config/runtime'

// Сейчас все сервисы по умолчанию используют localStorage.
// Appwrite mode будет подключаться по одному сервису, начиная с authService/eventService/photoService.

export function getDataMode() {
  return runtimeConfig.dataMode
}

export function isLocalMode() {
  return getDataMode() === 'local'
}

export function isAppwriteMode() {
  return getDataMode() === 'appwrite'
}
