import type { EventAchievement, ParticipantAchievement } from '../types/achievement'
import type { GalleryEvent } from '../types/event'
import type { GalleryPhoto } from '../types/photo'
import type { EventParticipant } from '../types/participant'
import { achievementService } from './achievementService'

export const ACTIVE_AUTOMATIC_TEMPLATE_IDS = ['first-frame'] as const

export type ActiveAutomaticTemplateId = (typeof ACTIVE_AUTOMATIC_TEMPLATE_IDS)[number]

export function isSupportedAutomaticTemplateId(templateId: string): templateId is ActiveAutomaticTemplateId {
  return ACTIVE_AUTOMATIC_TEMPLATE_IDS.includes(templateId as ActiveAutomaticTemplateId)
}

function getAchievementConfigKey(achievement: Pick<EventAchievement, 'id' | 'templateId'>) {
  return achievement.templateId ?? achievement.id
}

function getAwardsForAchievement(
  awards: ParticipantAchievement[],
  achievement: EventAchievement,
  achievements: EventAchievement[],
) {
  const configKey = getAchievementConfigKey(achievement)

  return awards.filter((award) => {
    if (award.achievementId === achievement.id) {
      return true
    }

    const awardedAchievement = achievements.find((item) => item.id === award.achievementId)
    if (!awardedAchievement) {
      return false
    }

    return getAchievementConfigKey(awardedAchievement) === configKey
  })
}

function findEnabledAutomaticAchievement(
  achievements: EventAchievement[],
  templateId: ActiveAutomaticTemplateId,
) {
  if (!isSupportedAutomaticTemplateId(templateId)) {
    return null
  }

  return (
    achievements.find(
      (achievement) =>
        achievement.selected !== false &&
        achievement.scope === 'automatic' &&
        (achievement.conditionType === 'first_photo' ||
          achievement.templateId === templateId ||
          (!achievement.templateId && achievement.id === templateId)),
    ) ?? null
  )
}

function getPhotoTimestamp(photo: GalleryPhoto) {
  const time = Date.parse(photo.createdAt ?? '')
  return Number.isFinite(time) ? time : Number.MAX_SAFE_INTEGER
}

function sortPhotosByCreatedAt(photos: GalleryPhoto[]) {
  return [...photos].sort((left, right) => {
    const delta = getPhotoTimestamp(left) - getPhotoTimestamp(right)
    if (delta !== 0) {
      return delta
    }
    return left.id.localeCompare(right.id)
  })
}

function resolvePhotoParticipant(photo: GalleryPhoto, participants: EventParticipant[]) {
  if (photo.participantId) {
    const byParticipantId = participants.find((participant) => participant.id === photo.participantId)
    if (byParticipantId) {
      return byParticipantId
    }
  }

  if (photo.userId) {
    return participants.find((participant) => participant.userId === photo.userId) ?? null
  }

  return null
}

async function awardParticipantsIfNeeded(input: {
  eventId: string
  achievement: EventAchievement
  achievements: EventAchievement[]
  awards: ParticipantAchievement[]
  participants: EventParticipant[]
  awardedByUserId: string
}) {
  const toAward = input.participants.filter(
    (participant) =>
      !getAwardsForAchievement(input.awards, input.achievement, input.achievements).some(
        (award) => award.participantId === participant.id,
      ),
  )

  if (!toAward.length) {
    return false
  }

  await achievementService.awardAchievementToParticipants(
    input.eventId,
    input.achievement.id,
    toAward,
    input.awardedByUserId,
  )

  return true
}

async function processFirstPhotoAchievement(input: {
  event: GalleryEvent
  photos: GalleryPhoto[]
  achievements: EventAchievement[]
  participants: EventParticipant[]
  awards: ParticipantAchievement[]
  awardedByUserId: string
}) {
  const achievement = findEnabledAutomaticAchievement(input.achievements, 'first-frame')
  if (!achievement) {
    return false
  }

  if (getAwardsForAchievement(input.awards, achievement, input.achievements).length > 0) {
    return false
  }

  const firstPhoto = sortPhotosByCreatedAt(input.photos)[0]
  if (!firstPhoto) {
    return false
  }

  const participant = resolvePhotoParticipant(firstPhoto, input.participants)
  if (!participant) {
    return false
  }

  return awardParticipantsIfNeeded({
    eventId: input.event.id,
    achievement,
    achievements: input.achievements,
    awards: input.awards,
    participants: [participant],
    awardedByUserId: input.awardedByUserId,
  })
}

export async function processAutomaticAchievementsForEvent(input: {
  event: GalleryEvent
  photos: GalleryPhoto[]
  achievements: EventAchievement[]
  participants: EventParticipant[]
  awards: ParticipantAchievement[]
  awardedByUserId: string
}) {
  return processFirstPhotoAchievement(input)
}
