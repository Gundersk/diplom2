export type AchievementScope = 'automatic' | 'personal' | 'group'
export type AchievementMode = 'automatic' | 'manual'
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
  isCustom?: boolean
  createdBy?: string
  createdAt?: string
  updatedAt?: string
  mode?: AchievementMode
  isSystem?: boolean
}

export type MedalForm = {
  title: string
  description: string
  scope: Extract<AchievementScope, 'personal' | 'group'>
  icon: string
  tone: string
  saveAsTemplate: boolean
}
