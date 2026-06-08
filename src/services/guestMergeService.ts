/**
 * Слияние гостевой сессии в профиль при email OTP (Appwrite).
 * Переносит organizerId, participants, RSVP, чат; чинит права documentSecurity после входа.
 * clearGuestSessionLocalData — очистка local-кэша гостя при logout/upgrade.
 */
import type { Models } from 'appwrite'
import { APPWRITE_COLLECTIONS, APPWRITE_DATABASE_ID } from '../config/appwriteSchema'
import { hasAppwriteRuntimeConfig } from '../config/runtime'
import { appwriteDatabases, appwriteQuery } from '../lib/appwrite'
import {
  buildVerifiedOrganizerEventPermissions,
  buildVerifiedOwnerPermissions,
} from '../utils/appwriteDocumentPermissions'
import { isMergedGuestUserId, readMergedGuestUserIds, rememberMergedGuestUserId } from '../utils/mergedGuestIds'
import { resolveAvatarViewUrl } from '../utils/avatarUrl'
import { isAppwriteMode } from './adapters/dataMode'
import { participantService } from './participantService'

type EventOrganizerDocument = Models.Document & {
  organizerId: string
}

type RsvpDocument = Models.Document & {
  eventId: string
  userId: string
  participantId: string
  displayName: string
  avatarUrl?: string
}

type ChatMessageDocument = Models.Document & {
  eventId: string
  userId: string
  participantId: string
  authorName: string
  authorAvatarUrl?: string
  authorInitials?: string
}

// --- Appwrite: перенос событий и связанных документов по userId ---
function assertAppwriteReady(methodName: string) {
  if (!hasAppwriteRuntimeConfig() || !APPWRITE_DATABASE_ID) {
    throw new Error(`[guestMergeService] ${methodName} requires Appwrite runtime config.`)
  }
}

async function listOrganizerEvents(userId: string) {
  assertAppwriteReady('listOrganizerEvents')
  const response = await appwriteDatabases.listDocuments<EventOrganizerDocument>(
    APPWRITE_DATABASE_ID,
    APPWRITE_COLLECTIONS.events,
    [
      appwriteQuery.equal('organizerId', userId),
      appwriteQuery.limit(5000),
    ],
  )
  return response.documents
}


async function transferOrganizerEvents(guestUserId: string, profileUserId: string) {
  if (!guestUserId || !profileUserId || guestUserId === profileUserId) {
    return [] as string[]
  }

  const documents = await listOrganizerEvents(guestUserId)

  const results = await Promise.allSettled(
    documents.map((document) =>
      appwriteDatabases.updateDocument(
        APPWRITE_DATABASE_ID,
        APPWRITE_COLLECTIONS.events,
        document.$id,
        {
          organizerId: profileUserId,
          updatedAt: new Date().toISOString(),
        },
      ),
    ),
  )

  for (const result of results) {
    if (result.status === 'rejected') {
      console.warn('[guestMergeService] organizer transfer failed', result.reason)
    }
  }

  return documents.map((document) => document.$id)
}

async function listDocumentsByUserId<T extends Models.Document>(
  collectionId: string,
  userId: string,
) {
  assertAppwriteReady('listDocumentsByUserId')
  const response = await appwriteDatabases.listDocuments<T>(
    APPWRITE_DATABASE_ID,
    collectionId,
    [appwriteQuery.equal('userId', userId), appwriteQuery.limit(5000)],
  )
  return response.documents
}

async function migrateGuestRsvps(input: {
  guestUserId: string
  profileUserId: string
  participantIdByEventId: Map<string, string>
  displayName: string
  avatarUrl: string
}) {
  const documents = await listDocumentsByUserId<RsvpDocument>(APPWRITE_COLLECTIONS.rsvps, input.guestUserId)

  await Promise.allSettled(
    documents.map((document) =>
      appwriteDatabases.updateDocument(
        APPWRITE_DATABASE_ID,
        APPWRITE_COLLECTIONS.rsvps,
        document.$id,
        {
          userId: input.profileUserId,
          participantId: input.participantIdByEventId.get(document.eventId) ?? document.participantId,
          displayName: input.displayName,
          avatarUrl: input.avatarUrl,
          updatedAt: new Date().toISOString(),
        },
      ),
    ),
  )
}

async function migrateGuestChatMessages(input: {
  guestUserId: string
  profileUserId: string
  participantIdByEventId: Map<string, string>
  displayName: string
  avatarUrl: string
}) {
  const documents = await listDocumentsByUserId<ChatMessageDocument>(
    APPWRITE_COLLECTIONS.chatMessages,
    input.guestUserId,
  )

  await Promise.allSettled(
    documents.map((document) =>
      appwriteDatabases.updateDocument(
        APPWRITE_DATABASE_ID,
        APPWRITE_COLLECTIONS.chatMessages,
        document.$id,
        {
          userId: input.profileUserId,
          participantId: input.participantIdByEventId.get(document.eventId) ?? document.participantId,
          authorName: input.displayName,
          authorAvatarUrl: input.avatarUrl,
          updatedAt: new Date().toISOString(),
        },
      ),
    ),
  )
}

/** Пока активна гостевая сессия — переносим organizerId на будущий профиль. */
export async function transferGuestOrganizerEventsBeforeProfileLogin(
  guestUserId: string,
  profileUserId: string,
) {
  if (!isAppwriteMode() || !guestUserId || !profileUserId || guestUserId === profileUserId) {
    return [] as string[]
  }

  return await transferOrganizerEvents(guestUserId, profileUserId)
}

/**
 * Слияние гостя в профиль, пока ещё активна гостевая сессия (можно менять/удалять свои документы).
 */
export async function mergeGuestSessionBeforeProfileLogin(input: {
  guestUserId: string
  profileUserId: string
  profileDisplayName: string
  profileAvatarUrl?: string
  profileAvatarFileId?: string
}) {
  const { guestUserId, profileUserId, profileDisplayName, profileAvatarUrl, profileAvatarFileId } = input
  if (!isAppwriteMode() || !guestUserId || !profileUserId || guestUserId === profileUserId) {
    return { mergedEventIds: [] as string[] }
  }

  const avatarUrl = resolveAvatarViewUrl(profileAvatarUrl, profileAvatarFileId) ?? ''
  const [guestParticipations, profileParticipations] = await Promise.all([
    participantService.getUserParticipations(guestUserId),
    participantService.getUserParticipations(profileUserId),
  ])

  const profileByEventId = new Map(profileParticipations.map((item) => [item.eventId, item]))
  const participantIdByEventId = new Map<string, string>()
  const mergedEventIds = new Set<string>()

  for (const guestParticipation of guestParticipations) {
    const existingProfileParticipation = profileByEventId.get(guestParticipation.eventId)

    if (existingProfileParticipation) {
      if (guestParticipation.role === 'organizer' && existingProfileParticipation.role !== 'organizer') {
        await participantService.updateParticipantRole(existingProfileParticipation.id, 'organizer')
        existingProfileParticipation.role = 'organizer'
      }
      await participantService.leaveEvent(guestParticipation.id)
      participantIdByEventId.set(guestParticipation.eventId, existingProfileParticipation.id)
      mergedEventIds.add(guestParticipation.eventId)
      continue
    }

    const reassigned = await participantService.reassignParticipationToUser({
      participantId: guestParticipation.id,
      userId: profileUserId,
      displayName: profileDisplayName,
      avatarUrl,
      avatarFileId: profileAvatarFileId,
    })

    profileByEventId.set(guestParticipation.eventId, reassigned)
    participantIdByEventId.set(guestParticipation.eventId, reassigned.id)
    mergedEventIds.add(guestParticipation.eventId)
  }

  await transferOrganizerEvents(guestUserId, profileUserId)

  await migrateGuestRsvps({
    guestUserId,
    profileUserId,
    participantIdByEventId,
    displayName: profileDisplayName,
    avatarUrl,
  })

  await migrateGuestChatMessages({
    guestUserId,
    profileUserId,
    participantIdByEventId,
    displayName: profileDisplayName,
    avatarUrl,
  })

  rememberMergedGuestUserId(guestUserId, profileUserId)

  return { mergedEventIds: [...mergedEventIds] }
}

/** После входа в профиль (если гостевая сессия уже сброшена). */
export async function mergeGuestDataIntoProfile(input: {
  guestUserId: string
  profileUserId: string
  profileDisplayName: string
  profileAvatarUrl?: string
  profileAvatarFileId?: string
}) {
  return mergeGuestSessionBeforeProfileLogin(input)
}

/** Починка событий, созданных гостем: organizerId и права на документ. */
export async function repairProfileOrganizerOwnership(profileUserId: string) {
  if (!isAppwriteMode() || !profileUserId) {
    return { repairedEventIds: [] as string[] }
  }

  const mergedGuestIds = readMergedGuestUserIds()
  const organizerParticipations = (await participantService.getUserParticipations(profileUserId)).filter(
    (item) => item.role === 'organizer',
  )
  const eventIdsToRepair = new Set<string>()

  for (const participation of organizerParticipations) {
    eventIdsToRepair.add(participation.eventId)
  }

  for (const guestUserId of mergedGuestIds) {
    const guestOrganizerEvents = await listOrganizerEvents(guestUserId)
    for (const document of guestOrganizerEvents) {
      eventIdsToRepair.add(document.$id)
    }
  }

  const participations = await participantService.getUserParticipations(profileUserId)
  for (const participation of participations) {
    try {
      const document = await appwriteDatabases.getDocument<EventOrganizerDocument>(
        APPWRITE_DATABASE_ID,
        APPWRITE_COLLECTIONS.events,
        participation.eventId,
      )
      if (document.organizerId === profileUserId) {
        eventIdsToRepair.add(participation.eventId)
        continue
      }

      if (!document.organizerId) {
        continue
      }

      if (isMergedGuestUserId(document.organizerId)) {
        eventIdsToRepair.add(participation.eventId)
        continue
      }

      const organizerParticipant = await participantService.getOrganizerParticipant(
        participation.eventId,
        document.organizerId,
      )
      if (organizerParticipant?.userId === profileUserId || !organizerParticipant) {
        rememberMergedGuestUserId(document.organizerId)
        eventIdsToRepair.add(participation.eventId)
      }
    } catch (error) {
      console.warn('[guestMergeService] failed to inspect event for repair', {
        eventId: participation.eventId,
        error,
      })
    }
  }

  const repairedEventIds: string[] = []

  for (const eventId of eventIdsToRepair) {
    try {
      const document = await appwriteDatabases.getDocument<EventOrganizerDocument>(
        APPWRITE_DATABASE_ID,
        APPWRITE_COLLECTIONS.events,
        eventId,
      )

      const participation = participations.find((item) => item.eventId === eventId)
      if (participation && participation.role !== 'organizer') {
        await participantService.updateParticipantRole(participation.id, 'organizer')
      }

      if (document.organizerId === profileUserId) {
        continue
      }

      await appwriteDatabases.updateDocument(
        APPWRITE_DATABASE_ID,
        APPWRITE_COLLECTIONS.events,
        eventId,
        {
          organizerId: profileUserId,
          updatedAt: new Date().toISOString(),
        },
      )
      repairedEventIds.push(eventId)
    } catch (error) {
      console.warn('[guestMergeService] repair organizer ownership failed', { eventId, error })
    }
  }

  await finalizeVerifiedDocumentPermissions(profileUserId)

  return { repairedEventIds }
}

// --- После repair: права organizer/owner на events, participants, rsvps, chat ---
async function finalizeVerifiedDocumentPermissions(profileUserId: string) {
  const participations = await participantService.getUserParticipations(profileUserId)
  const eventIds = new Set(participations.map((item) => item.eventId))

  for (const eventId of eventIds) {
    try {
      await appwriteDatabases.updateDocument(
        APPWRITE_DATABASE_ID,
        APPWRITE_COLLECTIONS.events,
        eventId,
        { updatedAt: new Date().toISOString() },
        buildVerifiedOrganizerEventPermissions(profileUserId),
      )
    } catch (error) {
      console.warn('[guestMergeService] finalize verified event permissions failed', { eventId, error })
    }
  }

  await Promise.allSettled(
    participations.map((participation) =>
      appwriteDatabases.updateDocument(
        APPWRITE_DATABASE_ID,
        APPWRITE_COLLECTIONS.participants,
        participation.id,
        { updatedAt: new Date().toISOString() },
        buildVerifiedOwnerPermissions(profileUserId),
      ),
    ),
  )

  for (const collectionId of [APPWRITE_COLLECTIONS.rsvps, APPWRITE_COLLECTIONS.chatMessages] as const) {
    const documents = await listDocumentsByUserId<Models.Document>(collectionId, profileUserId)
    await Promise.allSettled(
      documents.map((document) =>
        appwriteDatabases.updateDocument(
          APPWRITE_DATABASE_ID,
          collectionId,
          document.$id,
          { updatedAt: new Date().toISOString() },
          buildVerifiedOwnerPermissions(profileUserId),
        ),
      ),
    )
  }
}

export function clearGuestSessionLocalData(
  guestUserId?: string,
  reason: 'logout' | 'upgrade' = 'logout',
) {
  if (typeof window === 'undefined' || !window.localStorage) return

  window.localStorage.removeItem('event-gallery:pending-email-login')

  if (reason === 'upgrade' || !guestUserId || isAppwriteMode()) {
    return
  }

  window.localStorage.removeItem(`event-gallery.home-events:${guestUserId}`)
  participantService.removeLocalParticipationsForUser(guestUserId)
}
