import { Permission, Role } from 'appwrite'

/** Права при создании документа (создатель может выставить себе delete). */
export function buildOrganizerEventPermissions(organizerUserId: string) {
  return [
    Permission.read(Role.users()),
    Permission.update(Role.users()),
    Permission.delete(Role.user(organizerUserId)),
  ]
}

export function buildUserOwnedDocumentPermissions(userId: string) {
  return [
    Permission.read(Role.users()),
    Permission.update(Role.users()),
    Permission.delete(Role.user(userId)),
  ]
}

/** После входа по email (verified user) — уточняем delete под verified-роль. */
export function buildVerifiedOwnerPermissions(userId: string) {
  return [
    Permission.read(Role.users()),
    Permission.update(Role.users()),
    Permission.delete(Role.user(userId, 'verified')),
  ]
}

export function buildVerifiedOrganizerEventPermissions(organizerUserId: string) {
  return buildVerifiedOwnerPermissions(organizerUserId)
}
