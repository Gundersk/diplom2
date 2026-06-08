/**
 * Локальное хранение бинарных файлов в IndexedDB (офлайн-режим).
 * Ссылки вида idb://event-gallery/<key> резолвятся в blob: URL с кэшем в памяти.
 */
import { isAppwriteMode } from '../services/adapters/dataMode'

export const LOCAL_BLOB_URL_PREFIX = 'idb://event-gallery/'

const DB_NAME = 'event-gallery-local-blobs'
const DB_VERSION = 1
const STORE_NAME = 'blobs'

const resolvedUrlCache = new Map<string, string>()

let dbPromise: Promise<IDBDatabase> | null = null

export function isLocalBlobRef(value?: string) {
  return Boolean(value?.startsWith(LOCAL_BLOB_URL_PREFIX))
}

export function createLocalBlobRef(key: string) {
  return `${LOCAL_BLOB_URL_PREFIX}${key}`
}

export function getLocalBlobKey(ref?: string) {
  if (!ref?.startsWith(LOCAL_BLOB_URL_PREFIX)) {
    return undefined
  }

  return ref.slice(LOCAL_BLOB_URL_PREFIX.length)
}

export function getCachedLocalBlobUrl(ref?: string) {
  if (!ref) return undefined
  if (ref.startsWith('blob:') || ref.startsWith('data:')) {
    return ref
  }
  if (!isLocalBlobRef(ref)) {
    return ref
  }
  return resolvedUrlCache.get(ref)
}

function canUseIndexedDb() {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined'
}

function openDatabase() {
  if (!canUseIndexedDb()) {
    return Promise.reject(new Error('IndexedDB недоступен в этом окружении.'))
  }

  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION)

      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME)
        }
      }

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('Не удалось открыть IndexedDB.'))
    })
  }

  return dbPromise
}

async function withStore<T>(mode: IDBTransactionMode, handler: (store: IDBObjectStore) => IDBRequest<T>) {
  const db = await openDatabase()

  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode)
    const store = transaction.objectStore(STORE_NAME)
    const request = handler(store)

    request.onsuccess = () => resolve(request.result as T)
    request.onerror = () => reject(request.error ?? new Error('Операция IndexedDB завершилась с ошибкой.'))
  })
}

async function saveBlob(key: string, blob: Blob) {
  invalidateResolvedBlobCacheForKey(key)
  await withStore('readwrite', (store) => store.put(blob, key))
}

function invalidateResolvedBlobCacheForKey(key: string) {
  invalidateResolvedBlobCache(createLocalBlobRef(key))
}

export function invalidateResolvedBlobCache(ref?: string) {
  if (!ref || !isLocalBlobRef(ref)) {
    return
  }

  const cached = resolvedUrlCache.get(ref)
  if (cached) {
    URL.revokeObjectURL(cached)
    resolvedUrlCache.delete(ref)
  }
}

export async function replaceLocalImageFile(
  file: File,
  key: string,
  options: { maxDimension: number; quality?: number },
  previousRef?: string,
) {
  const nextRef = await saveLocalImageFile(file, key, options)

  if (previousRef && previousRef !== nextRef) {
    await deleteLocalBlobRef(previousRef)
  }

  return nextRef
}

async function readBlob(key: string) {
  const blob = await withStore<Blob | undefined>('readonly', (store) => store.get(key))
  return blob ?? null
}

async function deleteBlob(key: string) {
  await withStore('readwrite', (store) => store.delete(key))
}

function loadImageFromFile(file: Blob) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()

    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Не удалось декодировать изображение.'))
    }
    image.src = url
  })
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob)
        } else {
          reject(new Error('Не удалось сжать изображение.'))
        }
      },
      type,
      quality,
    )
  })
}

/** Сжимает изображение до maxDimension; GIF сохраняется без перекодирования. */
export async function prepareImageBlob(
  file: File,
  options: { maxDimension: number; quality?: number; mimeType?: string },
) {
  if (file.type === 'image/gif') {
    return file
  }

  const image = await loadImageFromFile(file)
  const maxDimension = Math.max(1, options.maxDimension)
  const scale = Math.min(1, maxDimension / Math.max(image.width, image.height))
  const width = Math.max(1, Math.round(image.width * scale))
  const height = Math.max(1, Math.round(image.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Canvas недоступен для обработки изображения.')
  }

  context.drawImage(image, 0, 0, width, height)

  const mimeType = options.mimeType ?? (file.type === 'image/png' ? 'image/png' : 'image/jpeg')
  const quality = options.quality ?? 0.86
  return canvasToBlob(canvas, mimeType, quality)
}

export async function saveLocalImageFile(
  file: File,
  key: string,
  options: { maxDimension: number; quality?: number },
) {
  const blob = await prepareImageBlob(file, options)
  await saveBlob(key, blob)
  return createLocalBlobRef(key)
}

export async function saveLocalBlobFromDataUrl(dataUrl: string, key: string) {
  const response = await fetch(dataUrl)
  const blob = await response.blob()
  await saveBlob(key, blob)
  return createLocalBlobRef(key)
}

export async function resolveLocalBlobUrl(ref?: string, options?: { force?: boolean }) {
  if (!ref) return undefined

  if (!options?.force) {
    const cached = getCachedLocalBlobUrl(ref)
    if (cached && cached !== ref) {
      return cached
    }
  } else {
    invalidateResolvedBlobCache(ref)
  }

  if (!isLocalBlobRef(ref)) {
    return ref
  }

  const key = getLocalBlobKey(ref)
  if (!key) {
    return undefined
  }

  const blob = await readBlob(key)
  if (!blob) {
    return undefined
  }

  const previous = resolvedUrlCache.get(ref)
  if (previous) {
    URL.revokeObjectURL(previous)
  }

  const objectUrl = URL.createObjectURL(blob)
  resolvedUrlCache.set(ref, objectUrl)
  return objectUrl
}

export async function deleteLocalBlobRef(ref?: string) {
  const key = getLocalBlobKey(ref)
  if (!key) return

  const cached = resolvedUrlCache.get(ref!)
  if (cached) {
    URL.revokeObjectURL(cached)
    resolvedUrlCache.delete(ref!)
  }

  await deleteBlob(key)
}

export function isPersistableLocalMediaRef(value?: string) {
  return isLocalBlobRef(value) || Boolean(value && !value.startsWith('data:') && !value.startsWith('blob:'))
}

/** Переносит data: URL из localStorage в IndexedDB (одноразовая миграция). */
export async function migrateLocalMediaFromLocalStorage() {
  if (isAppwriteMode() || typeof window === 'undefined' || !window.localStorage) {
    return
  }

  const currentUserRaw = window.localStorage.getItem('event-gallery:current-user')
  if (currentUserRaw) {
    try {
      const user = JSON.parse(currentUserRaw) as { id?: string; avatarUrl?: string }
      if (user.id && user.avatarUrl?.startsWith('data:')) {
        const avatarRef = await saveLocalBlobFromDataUrl(user.avatarUrl, `avatar:${user.id}`)
        window.localStorage.setItem(
          'event-gallery:current-user',
          JSON.stringify({
            ...user,
            avatarUrl: avatarRef,
          }),
        )
      }
    } catch (error) {
      console.warn('[localBlobStorage] failed to migrate current-user avatar', error)
    }
  }

  const photosRaw = window.localStorage.getItem('event-gallery:photos')
  if (!photosRaw) {
    return
  }

  try {
    const parsed = JSON.parse(photosRaw)
    if (!Array.isArray(parsed)) {
      return
    }

    let changed = false
    const nextPhotos = []

    for (const photo of parsed) {
      const imageUrl = photo?.imageUrl ?? photo?.src
      if (typeof imageUrl === 'string' && imageUrl.startsWith('data:') && photo?.id) {
        const ref = await saveLocalBlobFromDataUrl(imageUrl, `photo:${photo.id}`)
        nextPhotos.push({
          ...photo,
          imageUrl: ref,
          src: ref,
        })
        changed = true
        continue
      }

      nextPhotos.push(photo)
    }

    if (changed) {
      window.localStorage.setItem('event-gallery:photos', JSON.stringify(nextPhotos))
    }
  } catch (error) {
    console.warn('[localBlobStorage] failed to migrate event photos', error)
  }
}
