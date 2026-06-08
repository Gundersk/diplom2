/**
 * Разовая починка прав organizer/owner на событиях и связанных документах Appwrite.
 * Нужна после миграции гостя в профиль или смены organizerId.
 */
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { Client, Databases, Permission, Role, Query } from 'node-appwrite'

const ENV_FILE = path.resolve(process.cwd(), '.env')

const COLLECTIONS = {
  events: 'events',
  participants: 'participants',
  rsvps: 'rsvps',
  chatMessages: 'chat_messages',
} as const

import { buildVerifiedOrganizerEventPermissions, buildVerifiedOwnerPermissions } from '../src/utils/appwriteDocumentPermissions'

async function loadEnv(filePath: string) {
  const env: Record<string, string> = {}
  try {
    const raw = await readFile(filePath, 'utf8')
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const separatorIndex = trimmed.indexOf('=')
      if (separatorIndex <= 0) continue
      const key = trimmed.slice(0, separatorIndex).trim()
      const value = trimmed.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '')
      env[key] = value
    }
  } catch {
  }
  return env
}

function requireEnv(key: string, env: Record<string, string>) {
  const value = env[key]?.trim() || process.env[key]?.trim()
  if (!value) {
    throw new Error(`Missing ${key} in .env or environment.`)
  }
  return value
}

async function main() {
  const profileUserId = process.argv[2]?.trim()
  if (!profileUserId) {
    throw new Error('Usage: npm run repair:organizer -- <profileUserId>')
  }

  const env = await loadEnv(ENV_FILE)
  const client = new Client()
    .setEndpoint(requireEnv('APPWRITE_ENDPOINT', env))
    .setProject(requireEnv('APPWRITE_PROJECT_ID', env))
    .setKey(requireEnv('APPWRITE_API_KEY', env))

  const databases = new Databases(client)
  const databaseId = requireEnv('APPWRITE_DATABASE_ID', env)
  const now = new Date().toISOString()

  const participantsResponse = await databases.listDocuments(databaseId, COLLECTIONS.participants, [
    Query.equal('userId', profileUserId),
    Query.limit(5000),
  ])

  const eventIds = [...new Set(participantsResponse.documents.map((document) => String(document.eventId)))]
  console.log(`[repair:organizer] profile=${profileUserId}, participations=${participantsResponse.total}, events=${eventIds.length}`)

  for (const eventId of eventIds) {
    try {
      await databases.updateDocument(databaseId, COLLECTIONS.events, eventId, {
        organizerId: profileUserId,
        updatedAt: now,
      }, buildVerifiedOrganizerEventPermissions(profileUserId))
      console.log(`[repair:organizer] event updated: ${eventId}`)
    } catch (error) {
      console.warn(`[repair:organizer] event failed: ${eventId}`, error)
    }
  }

  for (const participant of participantsResponse.documents) {
    try {
      await databases.updateDocument(
        databaseId,
        COLLECTIONS.participants,
        participant.$id,
        { updatedAt: now },
        buildVerifiedOwnerPermissions(profileUserId),
      )
      console.log(`[repair:organizer] participant updated: ${participant.$id}`)
    } catch (error) {
      console.warn(`[repair:organizer] participant failed: ${participant.$id}`, error)
    }
  }

  for (const collectionId of [COLLECTIONS.rsvps, COLLECTIONS.chatMessages] as const) {
    const response = await databases.listDocuments(databaseId, collectionId, [
      Query.equal('userId', profileUserId),
      Query.limit(5000),
    ])

    for (const document of response.documents) {
      try {
        await databases.updateDocument(
          databaseId,
          collectionId,
          document.$id,
          { updatedAt: now },
          buildVerifiedOwnerPermissions(profileUserId),
        )
        console.log(`[repair:organizer] ${collectionId} updated: ${document.$id}`)
      } catch (error) {
        console.warn(`[repair:organizer] ${collectionId} failed: ${document.$id}`, error)
      }
    }
  }

  console.log('[repair:organizer] done')
}

main().catch((error) => {
  console.error('[repair:organizer]', error instanceof Error ? error.message : error)
  process.exitCode = 1
})
