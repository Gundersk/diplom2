export type DataMode = 'local' | 'appwrite'

type RuntimeConfig = {
  dataMode: DataMode
  appwriteEndpoint: string
  appwriteProjectId: string
  appwriteDatabaseId: string
  appwriteBucketId: string
}

function normalizeDataMode(value: unknown): DataMode {
  return value === 'appwrite' ? 'appwrite' : 'local'
}

const dataMode = normalizeDataMode(import.meta.env.VITE_DATA_MODE)

export const runtimeConfig: RuntimeConfig = {
  dataMode,
  appwriteEndpoint: import.meta.env.VITE_APPWRITE_ENDPOINT ?? '',
  appwriteProjectId: import.meta.env.VITE_APPWRITE_PROJECT_ID ?? '',
  appwriteDatabaseId: import.meta.env.VITE_APPWRITE_DATABASE_ID ?? '',
  appwriteBucketId: import.meta.env.VITE_APPWRITE_BUCKET_ID ?? '',
}

export function hasAppwriteRuntimeConfig() {
  return Boolean(
    runtimeConfig.appwriteEndpoint &&
      runtimeConfig.appwriteProjectId &&
      runtimeConfig.appwriteDatabaseId &&
      runtimeConfig.appwriteBucketId,
  )
}

if (import.meta.env.DEV && runtimeConfig.dataMode === 'appwrite' && !hasAppwriteRuntimeConfig()) {
  console.warn(
    '[runtimeConfig] VITE_DATA_MODE=appwrite, но Appwrite env заполнены не полностью. Приложение останется работоспособным в режиме подготовки.',
  )
}
