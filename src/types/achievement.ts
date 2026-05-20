export type AchievementScope = 'personal' | 'group'
export type AchievementMode = 'automatic' | 'manual'
export type AchievementConditionType = 'first_photo' | 'most_photos' | 'most_likes'

export type EventAchievement = {
  id: string
  title: string
  description: string
  icon: string
  tone: string
  scope: AchievementScope
  mode: AchievementMode
  conditionType?: AchievementConditionType
}

export type AchievementTemplate = {
  id: string
  title: string
  description: string
  scope: AchievementScope
  mode: AchievementMode
  conditionType?: AchievementConditionType
  icon: string
  tone: string
  isSystem: boolean
}

export type MedalForm = {
  title: string
  description: string
  scope: AchievementScope
  icon: string
  tone: string
  saveAsTemplate: boolean
}
