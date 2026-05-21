/// <reference types="vite/client" />

declare module 'emoji-picker-element'

interface ImportMetaEnv {
  readonly VITE_APP_URL?: string
  readonly VITE_DATABASE_URL?: string
  readonly VITE_DATA_MODE?: 'local' | 'appwrite'
  readonly VITE_APPWRITE_ENDPOINT?: string
  readonly VITE_APPWRITE_PROJECT_ID?: string
  readonly VITE_APPWRITE_DATABASE_ID?: string
  readonly VITE_APPWRITE_BUCKET_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
