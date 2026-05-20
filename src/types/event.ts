import type { EventAchievement } from './achievement'
import type { GalleryPhoto } from './photo'

export type EventTab = 'current' | 'upcoming' | 'past'
export type EventRole = 'Участник' | 'Организатор'

export type EventTheme = {
  id: string
  name: string
  mood: string
  emoji: string
  start: string
  mid: string
  end: string
  accent: string
  ink: string
}

export type EventChatMessage = {
  id: string
  eventId?: string
  userId?: string
  participantId?: string
  authorName: string
  authorInitials?: string
  text: string
  createdAt: string
  photoId?: string
}

export type RsvpStatus = 'going' | 'maybe' | 'cant_go'

export type EventRsvpEntry = {
  id: string
  eventId?: string
  userId?: string
  participantId?: string
  displayName?: string
  userName?: string
  userInitials?: string
  status: RsvpStatus
  message?: string
  createdAt: string
  updatedAt?: string
}

export type RsvpChoice = {
  id: RsvpStatus
  label: string
  symbol: string
}

export type EventInfoBlockType =
  | 'dress-code'
  | 'playlist'
  | 'bring'
  | 'link'
  | 'schedule'
  | 'payment'
  | 'other'

export type EventInfoBlock = {
  id: string
  type: EventInfoBlockType
  icon: string
  title: string
  description: string
  link: string
}

export type EventPaymentInfo = {
  amount: string
  destination: string
  comment: string
}

export type GalleryEvent = {
  id: string
  title: string
  status: EventTab
  startsAt: string
  endsAt: string
  role: EventRole
  organizerId?: string
  organizerName: string
  organizerInitials: string
  organizerTone: string
  organizerAvatarSrc?: string
  description?: string
  location: string
  savedCount: number
  totalCount: number
  coverStart: string
  coverEnd: string
  backgroundStart: string
  backgroundEnd: string
  accent: string
  allowGuestInvites?: boolean
  participantLimit?: null | number
  infoBlocks?: EventInfoBlock[]
  payment?: EventPaymentInfo | null
  timezoneLabel?: string
  titleStyle?: string
  rsvpStyle?: string
  achievements: EventAchievement[]
  photos: GalleryPhoto[]
  chatMessages: EventChatMessage[]
  guestRsvps: EventRsvpEntry[]
}

export type HomeNotification = {
  id: string
  title: string
  text: string
  time: string
}

export type CreateEventForm = {
  title: string
  titleStyle: string
  description: string
  startDate: string
  startHour: string
  startMinute: string
  endDate: string
  endHour: string
  endMinute: string
  timezone: string
  hostAlias: string
  location: string
  participantLimit: string
  coverAssetId: string
  backgroundAssetId: string
  backgroundMode: 'asset' | 'color'
  backgroundColor: string
  paymentEnabled: boolean
  costPerPerson: string
  uploadedCoverUrl: null | string
  uploadedBackgroundUrl: null | string
  infoBlocks: EventInfoBlock[]
  paymentDestination: string
  paymentComment: string
  allowGuestInvites: boolean
  rsvpStyle: string
  automaticExpanded: boolean
  personalExpanded: boolean
  groupExpanded: boolean
  automaticTemplateIds: string[]
  selectedPersonalTemplateIds: string[]
  selectedGroupTemplateIds: string[]
}

export type AssetOption = {
  id: string
  kind: 'image' | 'video'
  label: string
  src: string
  category?: 'gif' | 'poster'
}

export type TimezoneOption = {
  id: string
  label: string
}
