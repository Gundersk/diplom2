import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import {
  AppwriteException,
  Client,
  Compression,
  Databases,
  DatabasesIndexType,
  Permission,
  Role,
  Storage,
  type Models,
  type OrderBy,
} from 'node-appwrite'

type CollectionSchema = {
  id: string
  name: string
  permissions: string[]
  documentSecurity: boolean
  attributes: AttributeSchema[]
  indexes: IndexSchema[]
}

type AttributeSchema =
  | {
      kind: 'string'
      key: string
      size: number
      required: boolean
    }
  | {
      kind: 'boolean'
      key: string
      required: boolean
    }
  | {
      kind: 'integer'
      key: string
      required: boolean
    }

type IndexSchema = {
  key: string
  type: DatabasesIndexType
  attributes: string[]
  orders?: Array<'ASC' | 'DESC'>
}

type ExistingAttribute = {
  type?: string
  required?: boolean
  status?: string
  error?: string
  size?: number
}

type BucketSchema = {
  id: string
  name: string
  permissions: string[]
  fileSecurity: boolean
  enabled: boolean
  maximumFileSize: number
  allowedFileExtensions: string[]
  compression: Compression
  encryption: boolean
  antivirus: boolean
  transformations: boolean
}

function bucketMatches(existing: Models.Bucket, expected: BucketSchema) {
  const samePermissions = JSON.stringify(existing.$permissions ?? []) === JSON.stringify(expected.permissions)
  const sameFileSecurity = Boolean(existing.fileSecurity) === expected.fileSecurity
  const sameEnabled = Boolean(existing.enabled) === expected.enabled
  const sameMaximumFileSize = Number(existing.maximumFileSize ?? 0) === expected.maximumFileSize
  const sameAllowedExtensions =
    JSON.stringify((existing.allowedFileExtensions ?? []).map((item) => item.toLowerCase()).sort()) ===
    JSON.stringify(expected.allowedFileExtensions.map((item) => item.toLowerCase()).sort())
  const sameCompression = existing.compression === expected.compression
  const sameEncryption = Boolean(existing.encryption) === expected.encryption
  const sameAntivirus = Boolean(existing.antivirus) === expected.antivirus
  const sameTransformations = Boolean(existing.transformations) === expected.transformations

  return (
    samePermissions &&
    sameFileSecurity &&
    sameEnabled &&
    sameMaximumFileSize &&
    sameAllowedExtensions &&
    sameCompression &&
    sameEncryption &&
    sameAntivirus &&
    sameTransformations
  )
}

const ENV_FILE = path.resolve(process.cwd(), '.env.setup')
const ATTRIBUTE_POLL_ATTEMPTS = 30
const INDEX_POLL_ATTEMPTS = 30
const POLL_DELAY_MS = 1000

function logStep(message: string) {
  console.log(`[setup:appwrite] ${message}`)
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function normalizeEnvValue(value: string) {
  const trimmed = value.trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1)
  }

  return trimmed
}

async function loadSetupEnv(filePath: string) {
  const fileContents = await readFile(filePath, 'utf8')
  const env: Record<string, string> = {}

  for (const rawLine of fileContents.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) {
      continue
    }

    const separatorIndex = line.indexOf('=')
    if (separatorIndex === -1) {
      continue
    }

    const key = line.slice(0, separatorIndex).trim()
    const value = normalizeEnvValue(line.slice(separatorIndex + 1))

    if (key) {
      env[key] = value
      process.env[key] = value
    }
  }

  return env
}

function requireEnv(key: string, env: Record<string, string>) {
  const value = env[key] ?? process.env[key]
  if (!value?.trim()) {
    throw new Error(`Missing required ${key} in ${ENV_FILE}`)
  }

  return value.trim()
}

function getErrorCode(error: unknown) {
  if (error instanceof AppwriteException) {
    return error.code
  }

  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code
    return typeof code === 'number' ? code : undefined
  }

  return undefined
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}

function isNotFoundError(error: unknown) {
  return getErrorCode(error) === 404
}

function isConflictError(error: unknown) {
  return getErrorCode(error) === 409 || /already exists/i.test(getErrorMessage(error))
}

async function getCollectionOrNull(databases: Databases, databaseId: string, collectionId: string) {
  try {
    return await databases.getCollection({ databaseId, collectionId })
  } catch (error) {
    if (isNotFoundError(error)) {
      return null
    }

    throw error
  }
}

async function getAttributeOrNull(
  databases: Databases,
  databaseId: string,
  collectionId: string,
  key: string,
) {
  try {
    return await databases.getAttribute({ databaseId, collectionId, key })
  } catch (error) {
    if (isNotFoundError(error)) {
      return null
    }

    throw error
  }
}

async function getIndexOrNull(databases: Databases, databaseId: string, collectionId: string, key: string) {
  try {
    return await databases.getIndex({ databaseId, collectionId, key })
  } catch (error) {
    if (isNotFoundError(error)) {
      return null
    }

    throw error
  }
}

async function getBucketOrNull(storage: Storage, bucketId: string) {
  try {
    return await storage.getBucket({ bucketId })
  } catch (error) {
    if (isNotFoundError(error)) {
      return null
    }

    throw error
  }
}

async function waitForAttributeReady(
  databases: Databases,
  databaseId: string,
  collectionId: string,
  key: string,
) {
  for (let attempt = 1; attempt <= ATTRIBUTE_POLL_ATTEMPTS; attempt += 1) {
    const attribute = await getAttributeOrNull(databases, databaseId, collectionId, key)
    const status = attribute?.status?.toLowerCase()

    if (!attribute) {
      await sleep(POLL_DELAY_MS)
      continue
    }

    if (status === 'available') {
      return attribute
    }

    if (status === 'failed' || status === 'stuck') {
      throw new Error(
        `Attribute ${collectionId}.${key} failed to become available: ${attribute.error || status}`,
      )
    }

    await sleep(POLL_DELAY_MS)
  }

  throw new Error(`Timed out while waiting for attribute ${collectionId}.${key} to become available`)
}

async function waitForIndexReady(
  databases: Databases,
  databaseId: string,
  collectionId: string,
  key: string,
) {
  for (let attempt = 1; attempt <= INDEX_POLL_ATTEMPTS; attempt += 1) {
    const index = await getIndexOrNull(databases, databaseId, collectionId, key)
    const status = index?.status?.toLowerCase()

    if (!index) {
      await sleep(POLL_DELAY_MS)
      continue
    }

    if (status === 'available') {
      return index
    }

    if (status === 'failed' || status === 'stuck') {
      throw new Error(`Index ${collectionId}.${key} failed to become available: ${index.error || status}`)
    }

    await sleep(POLL_DELAY_MS)
  }

  throw new Error(`Timed out while waiting for index ${collectionId}.${key} to become available`)
}

function attributeMatches(existing: ExistingAttribute, expected: AttributeSchema) {
  const typeMatches = existing.type === expected.kind
  const requiredMatches = Boolean(existing.required) === expected.required

  if (!typeMatches || !requiredMatches) {
    return false
  }

  if (expected.kind === 'string') {
    return Number(existing.size ?? 0) === expected.size
  }

  return true
}

function indexMatches(existing: Models.Index, expected: IndexSchema) {
  const sameType = existing.type === expected.type
  const sameAttributes = JSON.stringify(existing.attributes ?? []) === JSON.stringify(expected.attributes)
  const sameOrders =
    JSON.stringify((existing.orders ?? []).map((item) => String(item).toUpperCase())) ===
    JSON.stringify((expected.orders ?? []).map((item) => item.toUpperCase()))
  return sameType && sameAttributes && sameOrders
}

async function waitForIndexRemoved(
  databases: Databases,
  databaseId: string,
  collectionId: string,
  key: string,
) {
  for (let attempt = 1; attempt <= INDEX_POLL_ATTEMPTS; attempt += 1) {
    const index = await getIndexOrNull(databases, databaseId, collectionId, key)
    if (!index) {
      return
    }

    await sleep(POLL_DELAY_MS)
  }

  throw new Error(`Timed out while waiting for index ${collectionId}.${key} to be removed`)
}

async function ensureCollection(
  databases: Databases,
  databaseId: string,
  schema: CollectionSchema,
) {
  const existing = await getCollectionOrNull(databases, databaseId, schema.id)
  if (existing) {
    logStep(`Collection ${schema.id} already exists, skipping creation.`)
    return existing
  }

  try {
    logStep(`Creating collection ${schema.id}...`)
    return await databases.createCollection({
      databaseId,
      collectionId: schema.id,
      name: schema.name,
      permissions: schema.permissions,
      documentSecurity: schema.documentSecurity,
      enabled: true,
    })
  } catch (error) {
    if (isConflictError(error)) {
      logStep(`Collection ${schema.id} already exists, skipping creation.`)
      return await databases.getCollection({ databaseId, collectionId: schema.id })
    }

    throw error
  }
}

async function ensureAttribute(
  databases: Databases,
  databaseId: string,
  collectionId: string,
  attribute: AttributeSchema,
) {
  const existing = await getAttributeOrNull(databases, databaseId, collectionId, attribute.key)
  if (existing) {
    if (!attributeMatches(existing, attribute)) {
      logStep(
        `Attribute ${collectionId}.${attribute.key} already exists with a different shape. Leaving it unchanged.`,
      )
    } else {
      logStep(`Attribute ${collectionId}.${attribute.key} already exists, skipping.`)
    }

    if (existing.status?.toLowerCase() !== 'available') {
      await waitForAttributeReady(databases, databaseId, collectionId, attribute.key)
    }
    return
  }

  try {
    logStep(`Creating attribute ${collectionId}.${attribute.key}...`)

    if (attribute.kind === 'string') {
      await databases.createStringAttribute({
        databaseId,
        collectionId,
        key: attribute.key,
        size: attribute.size,
        required: attribute.required,
      })
    } else if (attribute.kind === 'boolean') {
      await databases.createBooleanAttribute({
        databaseId,
        collectionId,
        key: attribute.key,
        required: attribute.required,
      })
    } else {
      await databases.createIntegerAttribute({
        databaseId,
        collectionId,
        key: attribute.key,
        required: attribute.required,
      })
    }
  } catch (error) {
    if (!isConflictError(error)) {
      throw error
    }

    logStep(`Attribute ${collectionId}.${attribute.key} already exists, skipping.`)
  }

  await waitForAttributeReady(databases, databaseId, collectionId, attribute.key)
}

async function ensureIndex(
  databases: Databases,
  databaseId: string,
  collectionId: string,
  index: IndexSchema,
) {
  const existing = await getIndexOrNull(databases, databaseId, collectionId, index.key)
  if (existing) {
    const status = existing.status?.toLowerCase()

    if (status === 'failed' || status === 'stuck') {
      logStep(`Index ${collectionId}.${index.key} is in status ${existing.status}. Recreating it.`)
      await databases.deleteIndex({
        databaseId,
        collectionId,
        key: index.key,
      })
      await waitForIndexRemoved(databases, databaseId, collectionId, index.key)
    } else {
      if (!indexMatches(existing, index)) {
        logStep(`Index ${collectionId}.${index.key} already exists with a different shape. Leaving it unchanged.`)
      } else {
        logStep(`Index ${collectionId}.${index.key} already exists, skipping.`)
      }

      if (status !== 'available') {
        await waitForIndexReady(databases, databaseId, collectionId, index.key)
      }
      return
    }
  }

  try {
    logStep(`Creating index ${collectionId}.${index.key}...`)
    await databases.createIndex({
      databaseId,
      collectionId,
      key: index.key,
      type: index.type,
      attributes: index.attributes,
      orders: index.orders as unknown as OrderBy[],
    })
  } catch (error) {
    if (!isConflictError(error)) {
      throw error
    }

    logStep(`Index ${collectionId}.${index.key} already exists, skipping.`)
  }

  await waitForIndexReady(databases, databaseId, collectionId, index.key)
}

async function ensureBucket(storage: Storage, schema: BucketSchema) {
  const existing = await getBucketOrNull(storage, schema.id)
  if (existing) {
    if (!bucketMatches(existing, schema)) {
      logStep(`Bucket ${schema.id} already exists with a different shape. Updating it.`)
      return await storage.updateBucket({
        bucketId: schema.id,
        name: schema.name,
        permissions: schema.permissions,
        fileSecurity: schema.fileSecurity,
        enabled: schema.enabled,
        maximumFileSize: schema.maximumFileSize,
        allowedFileExtensions: schema.allowedFileExtensions,
        compression: schema.compression,
        encryption: schema.encryption,
        antivirus: schema.antivirus,
        transformations: schema.transformations,
      })
    }

    logStep(`Bucket ${schema.id} already exists, skipping creation.`)
    return existing
  }

  try {
    logStep(`Creating bucket ${schema.id}...`)
    return await storage.createBucket({
      bucketId: schema.id,
      name: schema.name,
      permissions: schema.permissions,
      fileSecurity: schema.fileSecurity,
      enabled: schema.enabled,
      maximumFileSize: schema.maximumFileSize,
      allowedFileExtensions: schema.allowedFileExtensions,
      compression: schema.compression,
      encryption: schema.encryption,
      antivirus: schema.antivirus,
      transformations: schema.transformations,
    })
  } catch (error) {
    if (isConflictError(error)) {
      logStep(`Bucket ${schema.id} already exists, skipping creation.`)
      return await storage.getBucket({ bucketId: schema.id })
    }

    throw error
  }
}

const bucketSchema: BucketSchema = {
  id: process.env.APPWRITE_BUCKET_ID?.trim() || 'event_gallery_photos',
  name: 'Event Gallery Photos',
  permissions: [
    Permission.read(Role.users()),
    Permission.create(Role.users()),
  ],
  fileSecurity: true,
  enabled: true,
  maximumFileSize: 20 * 1024 * 1024,
  allowedFileExtensions: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'mp4', 'webm', 'avif'],
  compression: Compression.None,
  encryption: true,
  antivirus: true,
  transformations: true,
}

const collectionSchemas: CollectionSchema[] = [
  {
    id: 'profiles',
    name: 'Profiles',
    permissions: [Permission.create(Role.users())],
    documentSecurity: true,
    attributes: [
      { kind: 'string', key: 'userId', size: 64, required: true },
      { kind: 'string', key: 'displayName', size: 128, required: true },
      { kind: 'string', key: 'mode', size: 32, required: true },
      { kind: 'string', key: 'email', size: 255, required: false },
      { kind: 'string', key: 'avatarUrl', size: 4096, required: false },
      { kind: 'string', key: 'avatarEmoji', size: 32, required: false },
      { kind: 'string', key: 'createdAt', size: 64, required: true },
      { kind: 'string', key: 'updatedAt', size: 64, required: false },
    ],
    indexes: [
      {
        key: 'userId',
        type: DatabasesIndexType.Unique,
        attributes: ['userId'],
        orders: ['ASC'],
      },
    ],
  },
  {
    id: 'events',
    name: 'Events',
    permissions: [Permission.create(Role.users()), Permission.read(Role.users())],
    documentSecurity: true,
    attributes: [
      { kind: 'string', key: 'title', size: 255, required: true },
      { kind: 'string', key: 'description', size: 10000, required: false },
      { kind: 'string', key: 'startsAt', size: 64, required: false },
      { kind: 'string', key: 'endsAt', size: 64, required: false },
      { kind: 'string', key: 'timezone', size: 64, required: false },
      { kind: 'string', key: 'location', size: 512, required: false },
      { kind: 'string', key: 'organizerId', size: 64, required: true },
      { kind: 'string', key: 'inviteCode', size: 32, required: true },
      { kind: 'string', key: 'coverUrl', size: 4096, required: false },
      { kind: 'string', key: 'coverFileId', size: 64, required: false },
      { kind: 'string', key: 'backgroundFileId', size: 64, required: false },
      { kind: 'string', key: 'backgroundUrl', size: 4096, required: false },
      { kind: 'string', key: 'backgroundMode', size: 32, required: false },
      { kind: 'string', key: 'backgroundMediaType', size: 32, required: false },
      { kind: 'string', key: 'backgroundColor', size: 64, required: false },
      { kind: 'string', key: 'themeColor', size: 64, required: false },
      { kind: 'string', key: 'accent', size: 64, required: false },
      { kind: 'string', key: 'titleStyle', size: 64, required: false },
      { kind: 'string', key: 'rsvpStyle', size: 64, required: false },
      { kind: 'boolean', key: 'guestsCanInvite', required: false },
      { kind: 'integer', key: 'maxParticipants', required: false },
      { kind: 'boolean', key: 'isPaid', required: false },
      { kind: 'string', key: 'costPerPerson', size: 64, required: false },
      { kind: 'string', key: 'paymentDetails', size: 1024, required: false },
      { kind: 'string', key: 'paymentComment', size: 1024, required: false },
      { kind: 'string', key: 'createdAt', size: 64, required: true },
      { kind: 'string', key: 'updatedAt', size: 64, required: false },
    ],
    indexes: [
      {
        key: 'organizerId',
        type: DatabasesIndexType.Key,
        attributes: ['organizerId'],
        orders: ['ASC'],
      },
      {
        key: 'inviteCode',
        type: DatabasesIndexType.Unique,
        attributes: ['inviteCode'],
        orders: ['ASC'],
      },
      {
        key: 'startsAt',
        type: DatabasesIndexType.Key,
        attributes: ['startsAt'],
        orders: ['ASC'],
      },
    ],
  },
  {
    id: 'participants',
    name: 'Participants',
    permissions: [Permission.create(Role.users()), Permission.read(Role.users())],
    documentSecurity: true,
    attributes: [
      { kind: 'string', key: 'eventId', size: 64, required: true },
      { kind: 'string', key: 'userId', size: 64, required: true },
      { kind: 'string', key: 'displayName', size: 128, required: true },
      { kind: 'string', key: 'role', size: 32, required: true },
      { kind: 'integer', key: 'points', required: true },
      { kind: 'string', key: 'joinedAt', size: 64, required: true },
      { kind: 'string', key: 'updatedAt', size: 64, required: false },
    ],
    indexes: [
      {
        key: 'eventId',
        type: DatabasesIndexType.Key,
        attributes: ['eventId'],
        orders: ['ASC'],
      },
      {
        key: 'userId',
        type: DatabasesIndexType.Key,
        attributes: ['userId'],
        orders: ['ASC'],
      },
      {
        key: 'eventId_userId',
        type: DatabasesIndexType.Unique,
        attributes: ['eventId', 'userId'],
        orders: ['ASC', 'ASC'],
      },
    ],
  },
]

async function main() {
  const env = await loadSetupEnv(ENV_FILE)
  const endpoint = requireEnv('APPWRITE_ENDPOINT', env)
  const projectId = requireEnv('APPWRITE_PROJECT_ID', env)
  const databaseId = requireEnv('APPWRITE_DATABASE_ID', env)
  const apiKey = requireEnv('APPWRITE_API_KEY', env)
  const bucketId = env.APPWRITE_BUCKET_ID?.trim() || process.env.APPWRITE_BUCKET_ID?.trim()
  if (bucketId) {
    bucketSchema.id = bucketId
  }

  const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey)
  const databases = new Databases(client)
  const storage = new Storage(client)

  try {
    await databases.get({ databaseId })
  } catch (error) {
    throw new Error(
      `Cannot access database ${databaseId}. Check APPWRITE_ENDPOINT / APPWRITE_PROJECT_ID / APPWRITE_API_KEY. Original error: ${getErrorMessage(error)}`,
    )
  }

  await ensureBucket(storage, bucketSchema)

  for (const collectionSchema of collectionSchemas) {
    await ensureCollection(databases, databaseId, collectionSchema)

    for (const attribute of collectionSchema.attributes) {
      await ensureAttribute(databases, databaseId, collectionSchema.id, attribute)
    }

    for (const index of collectionSchema.indexes) {
      await ensureIndex(databases, databaseId, collectionSchema.id, index)
    }
  }

  logStep('Schema setup finished successfully.')
}

main().catch((error) => {
  console.error(`[setup:appwrite] ${getErrorMessage(error)}`)
  process.exitCode = 1
})
