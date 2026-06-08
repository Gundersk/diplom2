/**
 * Типы достижений события: шаблоны, настройки на событии и факты выдачи участникам.
 */
export type AchievementScope = 'automatic' | 'personal' | 'group'
export type AchievementMode = 'automatic' | 'manual'
export type AchievementVisibility = 'visible' | 'hint' | 'hidden'
export type AchievementConditionType = 'first_photo' | 'most_photos' | 'most_likes'

export type EventAchievement = {
  id: string
  eventId?: string
  templateId?: string
  scope: AchievementScope
  title: string
  description: string
  icon: string
  tone?: string
  points?: number
  selected?: boolean
  visibility?: AchievementVisibility
  createdBy?: string
  assignedToUserId?: string
  assignedToParticipantId?: string
  createdAt?: string
  updatedAt?: string
  mode?: AchievementMode
  conditionType?: AchievementConditionType
}

export type AchievementTemplate = {
  id: string
  scope: AchievementScope
  title: string
  description: string
  icon: string
  tone?: string
  points?: number
  conditionType?: AchievementConditionType
  visibility?: AchievementVisibility
  isCustom?: boolean
  createdBy?: string
  createdAt?: string
  updatedAt?: string
  mode?: AchievementMode
  isSystem?: boolean
}

/** Состояние формы создания/редактирования персональной или групповой медали. */
export type MedalForm = {
  title: string
  description: string
  scope: Extract<AchievementScope, 'personal' | 'group'>
  icon: string
  tone: string
  visibility: AchievementVisibility
  saveAsTemplate: boolean
}

export type ParticipantAchievement = {
  id: string
  eventId: string
  achievementId: string
  participantId: string
  userId: string
  awardedByUserId: string
  awardedAt: string
}
