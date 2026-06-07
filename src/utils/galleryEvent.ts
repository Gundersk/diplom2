import type { EventRole, EventTab, GalleryEvent } from '../types/event'
import type { EventAchievement } from '../types/achievement'
import { normalizeChatMessage } from '../types/chat'
import { normalizeRsvpEntry } from '../types/rsvp'
import type { EventRsvpEntry } from '../types/rsvp'

function inferBackgroundMediaType(source?: string) {
  if (!source) return 'image' as const

  if (/\.(mp4|webm)(\?.*)?$/i.test(source)) {
    return 'video' as const
  }

  if (/\.gif(\?.*)?$/i.test(source)) {
    return 'gif' as const
  }

  return 'image' as const
}

const automaticById: Record<
  string,
  { conditionType: EventAchievement['conditionType']; mode: EventAchievement['mode'] }
> = {
  'album-favorite': { conditionType: 'most_likes', mode: 'automatic' },
  'first-frame': { conditionType: 'first_photo', mode: 'automatic' },
  paparazzi: { conditionType: 'most_photos', mode: 'automatic' },
  'top-like': { conditionType: 'most_likes', mode: 'automatic' },
  'warm-frame': { conditionType: 'most_likes', mode: 'automatic' },
}

const groupIds = new Set([
  'after-defense',
  'group-shot',
  'nature-story',
  'photo-wave',
  'quiet-story',
  'route-done',
])

export function buildEventStatus(startsAt: string, endsAt: string): EventTab {
  const now = new Date()
  const start = new Date(startsAt)
  const end = Number.isNaN(new Date(endsAt).getTime()) ? new Date(startsAt) : new Date(endsAt)

  if (start > now) {
    return 'upcoming'
  }

  if (end < now) {
    return 'past'
  }

  return 'current'
}

function normalizeRole(role: string): EventRole {
  return role === 'Организатор' ? 'Организатор' : 'Участник'
}

export function normalizeGalleryEvent(event: GalleryEvent): GalleryEvent {
  const photos = (event.photos ?? []).map((photo) => ({
    ...photo,
    eventId: photo.eventId ?? event.id,
    authorName: photo.authorName ?? event.organizerName,
    imageUrl: photo.imageUrl ?? photo.src,
    likesCount: Number(photo.likesCount ?? photo.likes) || 0,
    likedBy: Array.isArray(photo.likedBy) ? photo.likedBy : [],
    badges: Array.isArray(photo.badges) ? photo.badges : [],
    createdAt: photo.createdAt ?? event.startsAt,
    likes: Number(photo.likes) || 0,
    saved: Boolean(photo.saved),
    src: photo.src ?? photo.imageUrl,
  }))

  return {
    ...event,
    status: buildEventStatus(event.startsAt, event.endsAt),
    role: normalizeRole(event.role),
    organizerId: event.organizerId,
    organizerAvatarSrc: event.organizerAvatarSrc,
    description: event.description ?? '',
    savedCount: photos.filter((photo) => photo.saved).length,
    totalCount: photos.length,
    coverEnd: event.coverEnd ?? event.coverStart,
    coverFileId: event.coverFileId,
    backgroundFileId: event.backgroundFileId,
    backgroundUrl:
      event.backgroundUrl ??
      (event.backgroundStart?.startsWith('#') ? undefined : event.backgroundStart),
    backgroundStart: event.backgroundStart ?? event.coverStart,
    backgroundEnd: event.backgroundEnd ?? event.coverEnd ?? event.coverStart,
    backgroundMode:
      event.backgroundMode ?? (event.backgroundStart?.startsWith('#') ? 'color' : 'asset'),
    backgroundMediaType:
      event.backgroundMode === 'color'
        ? undefined
        : event.backgroundMediaType ?? inferBackgroundMediaType(event.backgroundStart),
    backgroundColor:
      event.backgroundColor ??
      (event.backgroundStart?.startsWith('#') ? event.backgroundStart : undefined),
    allowGuestInvites: event.allowGuestInvites ?? false,
    participantLimit: event.participantLimit ?? null,
    infoBlocks: event.infoBlocks ?? [],
    payment: event.payment ?? null,
    timezoneLabel: event.timezoneLabel ?? 'Екатеринбург (UTC+5)',
    achievements: (event.achievements ?? []).map((achievement) => ({
      ...achievement,
      scope:
        achievement.scope ??
        (achievement.mode === 'automatic' || automaticById[achievement.id]
          ? 'automatic'
          : groupIds.has(achievement.id)
            ? 'group'
            : 'personal'),
      mode: achievement.mode ?? automaticById[achievement.id]?.mode ?? 'manual',
      conditionType: achievement.conditionType ?? automaticById[achievement.id]?.conditionType,
      selected: achievement.selected ?? true,
      createdAt: achievement.createdAt ?? event.startsAt,
    })),
    photos,
    chatMessages: (event.chatMessages ?? []).map((message) => normalizeChatMessage(message)),
    guestRsvps: (event.guestRsvps ?? []).map((entry) => normalizeRsvpEntry(entry as EventRsvpEntry)),
    titleStyle: event.titleStyle ?? 'classic',
    rsvpStyle: event.rsvpStyle ?? 'icons',
    textTheme: event.textTheme ?? 'auto',
  }
}
