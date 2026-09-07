export const USER_ROLES = ["member", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const AUTH_ROLES = ["guest", "member", "admin"] as const;
export type AuthRole = (typeof AUTH_ROLES)[number];

export function isUserRole(value: unknown): value is UserRole {
  return value === "member" || value === "admin";
}

export function isAuthRole(value: unknown): value is AuthRole {
  return value === "guest" || value === "member" || value === "admin";
}
