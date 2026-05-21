// TODO: add Appwrite implementation when VITE_DATA_MODE=appwrite

import { eventService } from './eventService'
import type {
  AchievementConditionType,
  AchievementScope,
  AchievementTemplate,
  EventAchievement,
} from '../types/achievement'

const TEMPLATE_STORAGE_KEY = 'event-gallery:achievement-templates'
const EVENT_ACHIEVEMENT_STORAGE_KEY = 'event-gallery:event-achievements'

const defaultNow = () => new Date().toISOString()

const defaultTemplates: AchievementTemplate[] = [
  {
    id: 'first-frame',
    scope: 'automatic',
    title: 'РџРµСЂРІС‹Р№ РєР°РґСЂ',
    description: 'Р’С‹РґР°РµС‚СЃСЏ СѓС‡Р°СЃС‚РЅРёРєСѓ, РєРѕС‚РѕСЂС‹Р№ РїРµСЂРІС‹Рј Р·Р°РіСЂСѓР·РёР» С„РѕС‚Рѕ РІ РѕР±С‰РёР№ Р°Р»СЊР±РѕРј СЃРѕР±С‹С‚РёСЏ.',
    icon: 'рџ“ё',
    tone: '#41d3bd,#5b8def',
    conditionType: 'first_photo',
    createdAt: defaultNow(),
    mode: 'automatic',
    isSystem: true,
  },
  {
    id: 'paparazzi',
    scope: 'automatic',
    title: 'РџР°РїР°СЂР°С†С†Рё',
    description: 'Р’С‹РґР°РµС‚СЃСЏ СѓС‡Р°СЃС‚РЅРёРєСѓ, РєРѕС‚РѕСЂС‹Р№ РґРѕР±Р°РІРёР» Р±РѕР»СЊС€Рµ РІСЃРµС… С„РѕС‚Рѕ РІ РѕР±С‰РёР№ Р°Р»СЊР±РѕРј.',
    icon: 'рџ“·',
    tone: '#ff7a59,#ffd166',
    conditionType: 'most_photos',
    createdAt: defaultNow(),
    mode: 'automatic',
    isSystem: true,
  },
  {
    id: 'photo-hype',
    scope: 'automatic',
    title: 'Хайпажор',
    description: 'В будущем выдается участнику, чье фото собрало больше всего комментариев в событии.',
    icon: '💬',
    tone: '#ffb703,#ffd8ef',
    conditionType: 'most_photo_comments',
    createdAt: defaultNow(),
    mode: 'automatic',
    isSystem: true,
  },
  {
    id: 'template-best-look',
    scope: 'personal',
    title: 'Р›СѓС‡С€РёР№ РѕР±СЂР°Р·',
    description: 'РћСЂРіР°РЅРёР·Р°С‚РѕСЂ РІСЂСѓС‡Р°РµС‚ СѓС‡Р°СЃС‚РЅРёРєСѓ Р·Р° СЃР°РјС‹Р№ РІС‹СЂР°Р·РёС‚РµР»СЊРЅС‹Р№ РѕР±СЂР°Р· СЃРѕР±С‹С‚РёСЏ.',
    icon: 'рџ’Ћ',
    tone: '#ff4d6d,#ffffff',
    createdAt: defaultNow(),
    mode: 'manual',
    isCustom: true,
    isSystem: false,
  },
  {
    id: 'template-soul',
    scope: 'personal',
    title: 'Р”СѓС€Р° РєРѕРјРїР°РЅРёРё',
    description: 'РћСЂРіР°РЅРёР·Р°С‚РѕСЂ РІСЂСѓС‡Р°РµС‚ СѓС‡Р°СЃС‚РЅРёРєСѓ, РєРѕС‚РѕСЂС‹Р№ Р»СѓС‡С€Рµ РІСЃРµС… РїРѕРґРґРµСЂР¶РёРІР°Р» Р°С‚РјРѕСЃС„РµСЂСѓ.',
    icon: 'вњЁ',
    tone: '#ffd166,#41d3bd',
    createdAt: defaultNow(),
    mode: 'manual',
    isCustom: true,
    isSystem: false,
  },
  {
    id: 'template-everyone',
    scope: 'group',
    title: 'Р’СЃРµ РѕС‚РјРµС‚РёР»РёСЃСЊ',
    description: 'Р“СЂСѓРїРїРѕРІР°СЏ РјРµРґР°Р»СЊ СЃРѕР±С‹С‚РёСЏ: РІСЃРµ РіРѕСЃС‚Рё РїРѕРґС‚РІРµСЂРґРёР»Рё СѓС‡Р°СЃС‚РёРµ Рё РїРѕСЏРІРёР»РёСЃСЊ РЅР° С„РѕС‚Рѕ.',
    icon: 'рџ‘Ґ',
    tone: '#5b8def,#f7f06d',
    createdAt: defaultNow(),
    mode: 'manual',
    isCustom: true,
    isSystem: false,
  },
]

function canUseLocalStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function createId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

function normalizeConditionType(value?: string): AchievementConditionType | undefined {
  if (
    value === 'first_photo' ||
    value === 'most_photos' ||
    value === 'most_likes' ||
    value === 'most_photo_comments'
  ) {
    return value
  }
  return undefined
}

function normalizeTemplate(template: AchievementTemplate): AchievementTemplate {
  const scope =
    template.scope ??
    (template.mode === 'automatic' ? 'automatic' : template.isSystem ? 'automatic' : 'personal')
  return {
    ...template,
    scope,
    tone: template.tone ?? '#ffd166,#41d3bd',
    points: template.points ?? 0,
    conditionType: normalizeConditionType(template.conditionType),
    isCustom: template.isCustom ?? !template.isSystem,
    createdAt: template.createdAt ?? defaultNow(),
    updatedAt: template.updatedAt,
    mode: template.mode ?? (scope === 'automatic' ? 'automatic' : 'manual'),
    isSystem: template.isSystem ?? scope === 'automatic',
  }
}

function normalizeEventAchievement(achievement: EventAchievement): EventAchievement {
  const scope =
    achievement.scope ??
    (achievement.mode === 'automatic' ? 'automatic' : achievement.conditionType ? 'automatic' : 'personal')
  return {
    ...achievement,
    scope,
    tone: achievement.tone ?? '#ffd166,#41d3bd',
    points: achievement.points ?? 0,
    selected: achievement.selected ?? true,
    createdAt: achievement.createdAt ?? defaultNow(),
    updatedAt: achievement.updatedAt,
    conditionType: normalizeConditionType(achievement.conditionType),
    mode: achievement.mode ?? (scope === 'automatic' ? 'automatic' : 'manual'),
  }
}

function readStoredTemplates(): AchievementTemplate[] {
  if (!canUseLocalStorage()) return []

  const raw = window.localStorage.getItem(TEMPLATE_STORAGE_KEY)
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      throw new Error('Stored templates payload is not an array.')
    }
    return parsed.map((template) => normalizeTemplate(template as AchievementTemplate))
  } catch {
    window.localStorage.removeItem(TEMPLATE_STORAGE_KEY)
    return []
  }
}

function persistTemplates(templates: AchievementTemplate[]) {
  if (!canUseLocalStorage()) return
  window.localStorage.setItem(
    TEMPLATE_STORAGE_KEY,
    JSON.stringify(templates.map((template) => normalizeTemplate(template))),
  )
}

function readStoredEventAchievements(): EventAchievement[] {
  if (!canUseLocalStorage()) return []

  const raw = window.localStorage.getItem(EVENT_ACHIEVEMENT_STORAGE_KEY)
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      throw new Error('Stored event achievements payload is not an array.')
    }
    return parsed.map((achievement) => normalizeEventAchievement(achievement as EventAchievement))
  } catch {
    window.localStorage.removeItem(EVENT_ACHIEVEMENT_STORAGE_KEY)
    return []
  }
}

function persistEventAchievements(achievements: EventAchievement[]) {
  if (!canUseLocalStorage()) return
  window.localStorage.setItem(
    EVENT_ACHIEVEMENT_STORAGE_KEY,
    JSON.stringify(achievements.map((achievement) => normalizeEventAchievement(achievement))),
  )
}

function mergeTemplates() {
  const storedTemplates = readStoredTemplates()
  const byId = new Map<string, AchievementTemplate>()

  for (const template of defaultTemplates) {
    byId.set(template.id, normalizeTemplate(template))
  }

  for (const template of storedTemplates) {
    byId.set(template.id, normalizeTemplate(template))
  }

  const nextTemplates = [...byId.values()]
  persistTemplates(nextTemplates)
  return nextTemplates
}

function migrateEventAchievementsIfNeeded(eventId: string) {
  const storedAchievements = readStoredEventAchievements()
  const eventAchievements = storedAchievements.filter((achievement) => achievement.eventId === eventId)
  if (eventAchievements.length > 0) {
    return eventAchievements
  }

  const event = eventService.getHomeEvents().find((item) => item.id === eventId)
  if (!event || event.achievements.length === 0) {
    return []
  }

  const migratedAchievements = event.achievements.map((achievement) =>
    normalizeEventAchievement({
      ...achievement,
      eventId,
      templateId: achievement.templateId ?? achievement.id,
      selected: true,
      createdAt: achievement.createdAt ?? event.startsAt,
      scope:
        achievement.scope ??
        (achievement.mode === 'automatic' || achievement.conditionType ? 'automatic' : 'personal'),
    }),
  )

  persistEventAchievements([...storedAchievements, ...migratedAchievements])
  return migratedAchievements
}

function getEventAchievementTemplateId(achievement: EventAchievement) {
  return achievement.templateId ?? achievement.id
}

export const achievementService = {
  async getAchievementTemplates(scope?: AchievementScope): Promise<AchievementTemplate[]> {
    const templates = mergeTemplates()
    return scope ? templates.filter((template) => template.scope === scope) : templates
  },

  async getEventAchievements(eventId: string, scope?: AchievementScope): Promise<EventAchievement[]> {
    const stored = readStoredEventAchievements().filter((achievement) => achievement.eventId === eventId)
    const achievements = stored.length > 0 ? stored : migrateEventAchievementsIfNeeded(eventId)
    return scope ? achievements.filter((achievement) => achievement.scope === scope) : achievements
  },

  async selectAchievement(input: {
    eventId: string
    templateId?: string
    scope: AchievementScope
    title: string
    description: string
    icon: string
    tone?: string
    points?: number
    createdBy?: string
  }): Promise<EventAchievement> {
    const stored = readStoredEventAchievements()
    const existing = stored.find(
      (achievement) =>
        achievement.eventId === input.eventId &&
        getEventAchievementTemplateId(achievement) === (input.templateId ?? achievement.id),
    )

    if (existing) {
      const nextAchievement = normalizeEventAchievement({
        ...existing,
        ...input,
        selected: true,
        updatedAt: defaultNow(),
      })
      persistEventAchievements(
        stored.map((achievement) => (achievement.id === existing.id ? nextAchievement : achievement)),
      )
      return nextAchievement
    }

    const nextAchievement = normalizeEventAchievement({
      id: createId('event-achievement'),
      eventId: input.eventId,
      templateId: input.templateId,
      scope: input.scope,
      title: input.title,
      description: input.description,
      icon: input.icon,
      tone: input.tone,
      points: input.points,
      selected: true,
      createdBy: input.createdBy,
      createdAt: defaultNow(),
      mode: input.scope === 'automatic' ? 'automatic' : 'manual',
    })

    persistEventAchievements([...stored, nextAchievement])
    return nextAchievement
  },

  async unselectAchievement(eventAchievementId: string): Promise<void> {
    const nextAchievements = readStoredEventAchievements().filter(
      (achievement) => achievement.id !== eventAchievementId,
    )
    persistEventAchievements(nextAchievements)
  },

  async createAchievementTemplate(input: {
    scope: 'personal' | 'group'
    title: string
    description: string
    icon: string
    tone?: string
    points?: number
    createdBy?: string
  }): Promise<AchievementTemplate> {
    const nextTemplate = normalizeTemplate({
      id: createId('template'),
      scope: input.scope,
      title: input.title,
      description: input.description,
      icon: input.icon,
      tone: input.tone,
      points: input.points,
      createdBy: input.createdBy,
      createdAt: defaultNow(),
      mode: 'manual',
      isCustom: true,
      isSystem: false,
    })

    const nextTemplates = [...mergeTemplates().filter((template) => template.id !== nextTemplate.id), nextTemplate]
    persistTemplates(nextTemplates)
    return nextTemplate
  },

  async deleteAchievementTemplate(templateId: string): Promise<void> {
    const templates = mergeTemplates()
    const template = templates.find((item) => item.id === templateId)
    if (!template) return
    if (template.scope === 'automatic' || template.isSystem) {
      throw new Error('РђРІС‚РѕРјР°С‚РёС‡РµСЃРєРёРµ С€Р°Р±Р»РѕРЅС‹ СѓРґР°Р»СЏС‚СЊ РЅРµР»СЊР·СЏ.')
    }

    const isSelected = readStoredEventAchievements().some(
      (achievement) => getEventAchievementTemplateId(achievement) === templateId,
    )
    if (isSelected) {
      throw new Error('РќРµР»СЊР·СЏ СѓРґР°Р»РёС‚СЊ С€Р°Р±Р»РѕРЅ, РїРѕРєР° РѕРЅ РІС‹Р±СЂР°РЅ РІ СЃРѕР±С‹С‚РёРё.')
    }

    persistTemplates(templates.filter((item) => item.id !== templateId))
  },

  async updateAchievementTemplate(
    templateId: string,
    patch: Partial<AchievementTemplate>,
  ): Promise<AchievementTemplate> {
    const templates = mergeTemplates()
    const existing = templates.find((template) => template.id === templateId)
    if (!existing) {
      throw new Error('РЁР°Р±Р»РѕРЅ РґРѕСЃС‚РёР¶РµРЅРёСЏ РЅРµ РЅР°Р№РґРµРЅ.')
    }

    const nextTemplate = normalizeTemplate({
      ...existing,
      ...patch,
      updatedAt: defaultNow(),
    })

    persistTemplates(templates.map((template) => (template.id === templateId ? nextTemplate : template)))
    return nextTemplate
  },

  async assignAchievement(input: {
    eventAchievementId: string
    userId: string
    participantId: string
  }): Promise<EventAchievement> {
    const achievements = readStoredEventAchievements()
    const existing = achievements.find((achievement) => achievement.id === input.eventAchievementId)
    if (!existing) {
      throw new Error('Р”РѕСЃС‚РёР¶РµРЅРёРµ СЃРѕР±С‹С‚РёСЏ РЅРµ РЅР°Р№РґРµРЅРѕ.')
    }

    const nextAchievement = normalizeEventAchievement({
      ...existing,
      assignedToUserId: input.userId,
      assignedToParticipantId: input.participantId,
      updatedAt: defaultNow(),
    })

    persistEventAchievements(
      achievements.map((achievement) =>
        achievement.id === input.eventAchievementId ? nextAchievement : achievement,
      ),
    )
    return nextAchievement
  },
}

