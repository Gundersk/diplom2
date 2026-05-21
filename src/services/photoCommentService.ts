// TODO: add Appwrite implementation when VITE_DATA_MODE=appwrite

import type { PhotoComment } from '../types/photoComment'

const PHOTO_COMMENT_STORAGE_KEY = 'event-gallery:photo-comments'

function canUseLocalStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function createId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

function normalizeComment(comment: PhotoComment): PhotoComment {
  return {
    ...comment,
    text: comment.text.trim(),
    createdAt: comment.createdAt ?? new Date().toISOString(),
    updatedAt: comment.updatedAt,
  }
}

function sortComments(comments: PhotoComment[]) {
  return [...comments].sort(
    (first, second) => new Date(first.createdAt).getTime() - new Date(second.createdAt).getTime(),
  )
}

function readStoredComments(): PhotoComment[] {
  if (!canUseLocalStorage()) return []

  const raw = window.localStorage.getItem(PHOTO_COMMENT_STORAGE_KEY)
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      throw new Error('Stored photo comments payload is not an array.')
    }

    return sortComments(parsed.map((comment) => normalizeComment(comment as PhotoComment)))
  } catch {
    window.localStorage.removeItem(PHOTO_COMMENT_STORAGE_KEY)
    return []
  }
}

function persistComments(comments: PhotoComment[]) {
  if (!canUseLocalStorage()) return
  window.localStorage.setItem(
    PHOTO_COMMENT_STORAGE_KEY,
    JSON.stringify(sortComments(comments).map((comment) => normalizeComment(comment))),
  )
}

function updateStoredComment(commentId: string, updater: (comment: PhotoComment) => PhotoComment) {
  const comments = readStoredComments()
  const index = comments.findIndex((comment) => comment.id === commentId)
  if (index === -1) {
    throw new Error('Комментарий к фото не найден.')
  }

  const nextComment = normalizeComment(updater(comments[index]))
  comments[index] = nextComment
  persistComments(comments)
  return nextComment
}

export const photoCommentService = {
  async getPhotoComments(photoId: string): Promise<PhotoComment[]> {
    return sortComments(readStoredComments().filter((comment) => comment.photoId === photoId))
  },

  async getEventPhotoComments(eventId: string): Promise<PhotoComment[]> {
    return sortComments(readStoredComments().filter((comment) => comment.eventId === eventId))
  },

  async getPhotoCommentCount(photoId: string): Promise<number> {
    return (await this.getPhotoComments(photoId)).length
  },

  async addPhotoComment(input: {
    photoId: string
    eventId: string
    userId: string
    participantId: string
    authorName: string
    authorAvatarUrl?: string
    text: string
  }): Promise<PhotoComment> {
    const trimmedText = input.text.trim()
    if (!trimmedText) {
      throw new Error('Комментарий не может быть пустым.')
    }

    const nextComment = normalizeComment({
      id: createId('photo-comment'),
      photoId: input.photoId,
      eventId: input.eventId,
      userId: input.userId,
      participantId: input.participantId,
      authorName: input.authorName,
      authorAvatarUrl: input.authorAvatarUrl,
      text: trimmedText,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })

    persistComments([...readStoredComments(), nextComment])
    return nextComment
  },

  async updatePhotoComment(commentId: string, text: string): Promise<PhotoComment> {
    const trimmedText = text.trim()
    if (!trimmedText) {
      throw new Error('Комментарий не может быть пустым.')
    }

    return updateStoredComment(commentId, (comment) => ({
      ...comment,
      text: trimmedText,
      updatedAt: new Date().toISOString(),
    }))
  },

  async deletePhotoComment(commentId: string): Promise<void> {
    persistComments(readStoredComments().filter((comment) => comment.id !== commentId))
  },

  async deleteCommentsForPhoto(photoId: string): Promise<void> {
    persistComments(readStoredComments().filter((comment) => comment.photoId !== photoId))
  },
}
