export type UserRole =
  | "admin"
  | "analyst"
  | "viewer";

export interface Permissions {
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canConclude: boolean;
  canCharge: boolean;
  canDelete: boolean;
  canManageUsers: boolean;
}

export const ROLE_PERMISSIONS: Record<
  UserRole,
  Permissions
> = {
  admin: {
    canView: true,
    canCreate: true,
    canEdit: true,
    canConclude: true,
    canCharge: true,
    canDelete: true,
    canManageUsers: true,
  },

  analyst: {
    canView: true,
    canCreate: true,
    canEdit: true,
    canConclude: true,
    canCharge: true,
    canDelete: false,
    canManageUsers: false,
  },

  viewer: {
    canView: true,
    canCreate: false,
    canEdit: false,
    canConclude: false,
    canCharge: false,
    canDelete: false,
    canManageUsers: false,
  },
};