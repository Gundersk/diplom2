import type { Models } from 'appwrite'
import { Permission, Role } from 'appwrite'
import { APPWRITE_COLLECTIONS, APPWRITE_DATABASE_ID } from '../config/appwriteSchema'
import { hasAppwriteRuntimeConfig } from '../config/runtime'
import { appwriteDatabases, appwriteId, appwriteQuery } from '../lib/appwrite'
import type {
  AchievementConditionType,
  AchievementScope,
  AchievementTemplate,
  AchievementVisibility,
  EventAchievement,
  ParticipantAchievement,
} from '../types/achievement'
import type { EventParticipant } from '../types/participant'
import { isAppwriteMode } from './adapters/dataMode'
import { authService } from './authService'
import { eventService } from './eventService'

const TEMPLATE_STORAGE_KEY = 'event-gallery:achievement-templates'
const EVENT_ACHIEVEMENT_STORAGE_KEY = 'event-gallery:event-achievements'
const PARTICIPANT_ACHIEVEMENT_STORAGE_KEY = 'event-gallery:participant-achievements'

const defaultNow = () => new Date().toISOString()

type EventAchievementDocument = Models.Document & {
  eventId: string
  templateId?: string
  scope: AchievementScope
  title: string
  description?: string
  icon?: string
  tone?: string
  visibility: AchievementVisibility
  points?: number
  createdBy?: string
  createdAt: string
  updatedAt?: string
  selected?: boolean
}

type ParticipantAchievementDocument = Models.Document & {
  eventId: string
  achievementId: string
  participantId: string
  userId: string
  awardedByUserId: string
  awardedAt: string
}

function canUseLocalStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function createId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

function assertAppwriteReady(methodName: string) {
  if (!hasAppwriteRuntimeConfig() || !APPWRITE_DATABASE_ID) {
    const message =
      `[achievementService] ${methodName} requires Appwrite runtime config and existing achievement collections.`
    console.error(message)
    throw new Error('Appwrite mode is enabled, but the achievement adapter is not configured yet.')
  }
}

const defaultTemplates: AchievementTemplate[] = [
  {
    id: 'first-frame',
    scope: 'automatic',
    title: 'Первый кадр',
    description: 'Выдается участнику, который первым загрузил фото в общий альбом события.',
    icon: '📸',
    tone: '#41d3bd,#5b8def',
    conditionType: 'first_photo',
    createdAt: defaultNow(),
    mode: 'automatic',
    isSystem: true,
    visibility: 'visible',
  },
  {
    id: 'paparazzi',
    scope: 'automatic',
    title: 'Папарацци',
    description: 'Выдается участнику, который добавил больше всех фото в общий альбом.',
    icon: '📷',
    tone: '#ff7a59,#ffd166',
    conditionType: 'most_photos',
    createdAt: defaultNow(),
    mode: 'automatic',
    isSystem: true,
    visibility: 'visible',
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
    visibility: 'visible',
  },
  {
    id: 'template-best-look',
    scope: 'personal',
    title: 'Лучший образ',
    description: 'Организатор вручает участнику за самый выразительный образ события.',
    icon: '💎',
    tone: '#ff4d6d,#ffffff',
    createdAt: defaultNow(),
    mode: 'manual',
    isCustom: true,
    isSystem: false,
    visibility: 'visible',
  },
  {
    id: 'template-soul',
    scope: 'personal',
    title: 'Душа компании',
    description: 'Организатор вручает участнику, который лучше всех поддерживал атмосферу.',
    icon: '✨',
    tone: '#ffd166,#41d3bd',
    createdAt: defaultNow(),
    mode: 'manual',
    isCustom: true,
    isSystem: false,
    visibility: 'visible',
  },
  {
    id: 'template-everyone',
    scope: 'group',
    title: 'Все отметились',
    description: 'Групповая медаль события: все гости подтвердили участие и появились на фото.',
    icon: '👥',
    tone: '#5b8def,#f7f06d',
    createdAt: defaultNow(),
    mode: 'manual',
    isCustom: true,
    isSystem: false,
    visibility: 'visible',
  },
]

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

function normalizeVisibility(value?: string): AchievementVisibility {
  if (value === 'hint' || value === 'hidden' || value === 'visible') {
    return value
  }

  if (value === 'secret') {
    return 'hidden'
  }

  return 'visible'
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
    visibility: normalizeVisibility(template.visibility),
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
    visibility: normalizeVisibility(achievement.visibility),
    createdAt: achievement.createdAt ?? defaultNow(),
    updatedAt: achievement.updatedAt,
    conditionType: normalizeConditionType(achievement.conditionType),
    mode: achievement.mode ?? (scope === 'automatic' ? 'automatic' : 'manual'),
  }
}

function normalizeParticipantAchievement(award: ParticipantAchievement): ParticipantAchievement {
  return {
    ...award,
    awardedAt: award.awardedAt ?? defaultNow(),
  }
}

function normalizeEventAchievementDocument(document: EventAchievementDocument): EventAchievement {
  return normalizeEventAchievement({
    id: document.$id,
    eventId: document.eventId,
    templateId: document.templateId,
    scope: document.scope,
    title: document.title,
    description: document.description ?? '',
    icon: document.icon ?? '🏅',
    tone: document.tone,
    visibility: normalizeVisibility(document.visibility),
    points: document.points ?? 0,
    createdBy: document.createdBy,
    createdAt: document.createdAt ?? document.$createdAt,
    updatedAt: document.updatedAt ?? document.$updatedAt ?? document.$createdAt,
    selected: document.selected ?? true,
    mode: document.scope === 'automatic' ? 'automatic' : 'manual',
  })
}

function normalizeParticipantAchievementDocument(
  document: ParticipantAchievementDocument,
): ParticipantAchievement {
  return normalizeParticipantAchievement({
    id: document.$id,
    eventId: document.eventId,
    achievementId: document.achievementId,
    participantId: document.participantId,
    userId: document.userId,
    awardedByUserId: document.awardedByUserId,
    awardedAt: document.awardedAt ?? document.$createdAt,
  })
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

function readStoredParticipantAchievements(): ParticipantAchievement[] {
  if (!canUseLocalStorage()) return []

  const raw = window.localStorage.getItem(PARTICIPANT_ACHIEVEMENT_STORAGE_KEY)
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      throw new Error('Stored participant achievements payload is not an array.')
    }
    return parsed.map((award) => normalizeParticipantAchievement(award as ParticipantAchievement))
  } catch {
    window.localStorage.removeItem(PARTICIPANT_ACHIEVEMENT_STORAGE_KEY)
    return []
  }
}

function persistParticipantAchievements(awards: ParticipantAchievement[]) {
  if (!canUseLocalStorage()) return
  window.localStorage.setItem(
    PARTICIPANT_ACHIEVEMENT_STORAGE_KEY,
    JSON.stringify(awards.map((award) => normalizeParticipantAchievement(award))),
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

async function migrateEventAchievementsIfNeeded(eventId: string) {
  const storedAchievements = readStoredEventAchievements()
  const eventAchievements = storedAchievements.filter((achievement) => achievement.eventId === eventId)
  if (eventAchievements.length > 0) {
    return eventAchievements
  }

  const events = await eventService.getHomeEvents()
  const event = events.find((item) => item.id === eventId)
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
      visibility: normalizeVisibility(achievement.visibility),
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

async function getAppwriteAchievementPermissions(ownerUserId?: string) {
  const currentUser = await authService.getCurrentUser()
  const writeUserId = ownerUserId || currentUser?.id
  return [
    Permission.read(Role.users()),
    ...(writeUserId
      ? [Permission.update(Role.user(writeUserId)), Permission.delete(Role.user(writeUserId))]
      : []),
  ]
}

async function listEventAchievementDocuments(eventId: string) {
  const response = await appwriteDatabases.listDocuments<EventAchievementDocument>(
    APPWRITE_DATABASE_ID,
    APPWRITE_COLLECTIONS.eventAchievements,
    [appwriteQuery.equal('eventId', eventId), appwriteQuery.limit(5000)],
  )

  return response.documents
}

async function listParticipantAchievementDocuments(eventId: string) {
  const response = await appwriteDatabases.listDocuments<ParticipantAchievementDocument>(
    APPWRITE_DATABASE_ID,
    APPWRITE_COLLECTIONS.participantAchievements,
    [appwriteQuery.equal('eventId', eventId), appwriteQuery.limit(5000)],
  )

  return response.documents
}

async function findAppwriteEventAchievement(
  eventId: string,
  templateId?: string,
  title?: string,
) {
  const documents = await listEventAchievementDocuments(eventId)

  return (
    documents.find((document) => {
      if (templateId && document.templateId === templateId) {
        return true
      }

      return !templateId && title ? document.title === title : false
    }) ?? null
  )
}

async function deleteAwardsForAchievement(achievementId: string, eventId?: string) {
  if (!isAppwriteMode()) {
    persistParticipantAchievements(
      readStoredParticipantAchievements().filter((award) => award.achievementId !== achievementId),
    )
    return
  }

  assertAppwriteReady('deleteAwardsForAchievement')
  const documents = eventId
    ? await listParticipantAchievementDocuments(eventId)
    : await appwriteDatabases
        .listDocuments<ParticipantAchievementDocument>(
          APPWRITE_DATABASE_ID,
          APPWRITE_COLLECTIONS.participantAchievements,
          [appwriteQuery.equal('achievementId', achievementId), appwriteQuery.limit(5000)],
        )
        .then((response) => response.documents)

  await Promise.all(
    documents
      .filter((document) => document.achievementId === achievementId)
      .map((document) =>
        appwriteDatabases.deleteDocument(
          APPWRITE_DATABASE_ID,
          APPWRITE_COLLECTIONS.participantAchievements,
          document.$id,
        ),
      ),
  )
}

export const achievementService = {
  async getAchievementTemplates(scope?: AchievementScope): Promise<AchievementTemplate[]> {
    const templates = mergeTemplates()
    return scope ? templates.filter((template) => template.scope === scope) : templates
  },

  async getEventAchievements(eventId: string, scope?: AchievementScope): Promise<EventAchievement[]> {
    if (!isAppwriteMode()) {
      const stored = readStoredEventAchievements().filter((achievement) => achievement.eventId === eventId)
      const achievements = stored.length > 0 ? stored : await migrateEventAchievementsIfNeeded(eventId)
      return scope ? achievements.filter((achievement) => achievement.scope === scope) : achievements
    }

    assertAppwriteReady('getEventAchievements')
    const documents = await listEventAchievementDocuments(eventId)
    const achievements = documents
      .map((document) => normalizeEventAchievementDocument(document))
      .filter((achievement) => achievement.selected !== false)

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
    visibility?: AchievementVisibility
    createdBy?: string
  }): Promise<EventAchievement> {
    if (!isAppwriteMode()) {
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
          visibility: normalizeVisibility(input.visibility),
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
        visibility: normalizeVisibility(input.visibility),
        selected: true,
        createdBy: input.createdBy,
        createdAt: defaultNow(),
        mode: input.scope === 'automatic' ? 'automatic' : 'manual',
      })

      persistEventAchievements([...stored, nextAchievement])
      return nextAchievement
    }

    assertAppwriteReady('selectAchievement')
    const existing = await findAppwriteEventAchievement(input.eventId, input.templateId, input.title)
    const now = defaultNow()
    const payload = {
      eventId: input.eventId,
      templateId: input.templateId ?? '',
      scope: input.scope,
      title: input.title,
      description: input.description,
      icon: input.icon,
      tone: input.tone ?? '',
      visibility: normalizeVisibility(input.visibility),
      points: input.points ?? 0,
      createdBy: input.createdBy ?? '',
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      selected: true,
    }

    if (existing) {
      const updated = await appwriteDatabases.updateDocument<EventAchievementDocument>(
        APPWRITE_DATABASE_ID,
        APPWRITE_COLLECTIONS.eventAchievements,
        existing.$id,
        payload,
      )
      return normalizeEventAchievementDocument(updated)
    }

    const created = await appwriteDatabases.createDocument<EventAchievementDocument>(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTIONS.eventAchievements,
      appwriteId.unique(),
      payload,
      await getAppwriteAchievementPermissions(input.createdBy),
    )

    return normalizeEventAchievementDocument(created)
  },

  async unselectAchievement(eventAchievementId: string): Promise<void> {
    if (!isAppwriteMode()) {
      const existing = readStoredEventAchievements().find((achievement) => achievement.id === eventAchievementId)
      persistEventAchievements(
        readStoredEventAchievements().filter((achievement) => achievement.id !== eventAchievementId),
      )
      if (existing) {
        await deleteAwardsForAchievement(existing.id, existing.eventId)
      }
      return
    }

    assertAppwriteReady('unselectAchievement')
    const existing = await appwriteDatabases.getDocument<EventAchievementDocument>(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTIONS.eventAchievements,
      eventAchievementId,
    )
    await deleteAwardsForAchievement(eventAchievementId, existing.eventId)
    await appwriteDatabases.deleteDocument(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTIONS.eventAchievements,
      eventAchievementId,
    )
  },

  async createAchievementTemplate(input: {
    scope: 'personal' | 'group'
    title: string
    description: string
    icon: string
    tone?: string
    points?: number
    visibility?: AchievementVisibility
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
      visibility: normalizeVisibility(input.visibility),
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
      throw new Error('Автоматические шаблоны удалять нельзя.')
    }

    const isSelected = (await this.getAllEventAchievements()).some(
      (achievement) => getEventAchievementTemplateId(achievement) === templateId,
    )
    if (isSelected) {
      throw new Error('Нельзя удалить шаблон, пока он выбран в событии.')
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
      throw new Error('Шаблон достижения не найден.')
    }

    const nextTemplate = normalizeTemplate({
      ...existing,
      ...patch,
      updatedAt: defaultNow(),
    })

    persistTemplates(templates.map((template) => (template.id === templateId ? nextTemplate : template)))
    return nextTemplate
  },

  async getParticipantAchievements(eventId: string, participantId: string): Promise<ParticipantAchievement[]> {
    if (!isAppwriteMode()) {
      return readStoredParticipantAchievements().filter(
        (award) => award.eventId === eventId && award.participantId === participantId,
      )
    }

    assertAppwriteReady('getParticipantAchievements')
    const documents = await listParticipantAchievementDocuments(eventId)
    return documents
      .filter((document) => document.participantId === participantId)
      .map((document) => normalizeParticipantAchievementDocument(document))
  },

  async getEventAchievementAwards(eventId: string): Promise<ParticipantAchievement[]> {
    if (!isAppwriteMode()) {
      return readStoredParticipantAchievements().filter((award) => award.eventId === eventId)
    }

    assertAppwriteReady('getEventAchievementAwards')
    const documents = await listParticipantAchievementDocuments(eventId)
    return documents.map((document) => normalizeParticipantAchievementDocument(document))
  },

  async getAllEventAchievements(): Promise<EventAchievement[]> {
    if (!isAppwriteMode()) {
      return readStoredEventAchievements()
    }

    assertAppwriteReady('getAllEventAchievements')
    const response = await appwriteDatabases.listDocuments<EventAchievementDocument>(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTIONS.eventAchievements,
      [appwriteQuery.limit(5000)],
    )

    return response.documents.map((document) => normalizeEventAchievementDocument(document))
  },

  async awardAchievement(input: {
    eventId: string
    achievementId: string
    participantId: string
    userId: string
    awardedByUserId: string
  }): Promise<ParticipantAchievement> {
    if (!isAppwriteMode()) {
      const existing = readStoredParticipantAchievements().find(
        (award) =>
          award.achievementId === input.achievementId &&
          award.participantId === input.participantId,
      )
      if (existing) {
        return existing
      }

      const nextAward = normalizeParticipantAchievement({
        id: createId('participant-achievement'),
        eventId: input.eventId,
        achievementId: input.achievementId,
        participantId: input.participantId,
        userId: input.userId,
        awardedByUserId: input.awardedByUserId,
        awardedAt: defaultNow(),
      })
      persistParticipantAchievements([...readStoredParticipantAchievements(), nextAward])
      return nextAward
    }

    assertAppwriteReady('awardAchievement')
    const existingDocuments = await listParticipantAchievementDocuments(input.eventId)
    const existing = existingDocuments.find(
      (document) =>
        document.achievementId === input.achievementId &&
        document.participantId === input.participantId,
    )
    if (existing) {
      return normalizeParticipantAchievementDocument(existing)
    }

    const created = await appwriteDatabases.createDocument<ParticipantAchievementDocument>(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTIONS.participantAchievements,
      appwriteId.unique(),
      {
        eventId: input.eventId,
        achievementId: input.achievementId,
        participantId: input.participantId,
        userId: input.userId,
        awardedByUserId: input.awardedByUserId,
        awardedAt: defaultNow(),
      },
      await getAppwriteAchievementPermissions(input.awardedByUserId),
    )

    return normalizeParticipantAchievementDocument(created)
  },

  async awardAchievementToParticipants(
    eventId: string,
    achievementId: string,
    participants: Array<Pick<EventParticipant, 'id' | 'userId'>>,
    awardedByUserId: string,
  ): Promise<ParticipantAchievement[]> {
    for (const participant of participants) {
      if (!participant.id || !participant.userId) {
        throw new Error('У участника не хватает participantId или userId для выдачи достижения.')
      }
    }

    return Promise.all(
      participants.map((participant) =>
        this.awardAchievement({
          eventId,
          achievementId,
          participantId: participant.id,
          userId: participant.userId,
          awardedByUserId,
        }),
      ),
    )
  },

  async revokeAchievement(input: {
    eventId: string
    achievementId: string
    participantId: string
  }): Promise<void> {
    if (!isAppwriteMode()) {
      persistParticipantAchievements(
        readStoredParticipantAchievements().filter(
          (award) =>
            !(
              award.eventId === input.eventId &&
              award.achievementId === input.achievementId &&
              award.participantId === input.participantId
            ),
        ),
      )
      return
    }

    assertAppwriteReady('revokeAchievement')
    const documents = await listParticipantAchievementDocuments(input.eventId)
    const existing = documents.find(
      (document) =>
        document.achievementId === input.achievementId &&
        document.participantId === input.participantId,
    )
    if (!existing) return

    await appwriteDatabases.deleteDocument(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTIONS.participantAchievements,
      existing.$id,
    )
  },

  async revokeAchievementFromParticipants(
    eventId: string,
    achievementId: string,
    participants: Array<Pick<EventParticipant, 'id'>>,
  ): Promise<void> {
    for (const participant of participants) {
      if (!participant.id) {
        throw new Error('У участника не хватает participantId для отзыва достижения.')
      }
    }

    await Promise.all(
      participants.map((participant) =>
        this.revokeAchievement({
          eventId,
          achievementId,
          participantId: participant.id,
        }),
      ),
    )
  },
}
