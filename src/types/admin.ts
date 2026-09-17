export type AdminUserRole = "admin" | "editor";

export type AdminUserPublic = {
  id: string;
  email: string;
  role: AdminUserRole;
  createdAt: string;
  lastLoginAt: string | null;
};
