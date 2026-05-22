import { runtimeConfig } from './runtime'

export const APPWRITE_DATABASE_ID = runtimeConfig.appwriteDatabaseId

export const APPWRITE_COLLECTIONS = {
  profiles: 'profiles',
  events: 'events',
  participants: 'participants',
  photos: 'photos',
  eventPhotos: 'event_photos',
  savedPhotos: 'saved_photos',
  photoComments: 'photo_comments',
  achievementTemplates: 'achievement_templates',
  eventAchievements: 'event_achievements',
  participantAchievements: 'participant_achievements',
  rsvps: 'rsvps',
  chatMessages: 'chat_messages',
} as const

export const APPWRITE_BUCKETS = {
  eventVisuals: runtimeConfig.appwriteBucketId || 'event_gallery_photos',
  eventPhotos: runtimeConfig.appwriteBucketId || 'event_gallery_photos',
} as const

export type AppwriteCollectionKey = keyof typeof APPWRITE_COLLECTIONS
export type AppwriteBucketKey = keyof typeof APPWRITE_BUCKETS
