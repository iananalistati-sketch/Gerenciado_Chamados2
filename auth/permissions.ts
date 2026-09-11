import { DEFAULT_ROLE_PERMISSIONS, type PermissionMap, type UserRole } from "../shared/permissions";
export type { PermissionKey, PermissionMap, UserRole } from "../shared/permissions";
export { PERMISSION_CATALOG } from "../shared/permissions";

export interface Permissions {
  // Permissões legadas usadas pelas rotinas gerais.
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canConclude: boolean;
  canCharge: boolean;
  canDelete: boolean;
  canManageUsers: boolean;

  // Controle de Mobiles.
  canViewMobiles: boolean;
  canCreateMobile: boolean;
  canEditMobile: boolean;
  canDeleteMobile: boolean;
  canBulkUpdateMobiles: boolean;
  canChangeMobileStatus: boolean;
  canManageMobileMaintenance: boolean;
  canManageMobileConfig: boolean;

  // Empréstimos.
  canViewLoans: boolean;
  canCreateLoan: boolean;
  canReturnLoan: boolean;
  canClassifyLoanOccurrence: boolean;
  canIssueResponsibilityTerm: boolean;
  canEditOpenLoan: boolean;
  canCancelOpenLoan: boolean;
  canCorrectClosedLoanOccurrence: boolean;

  // Chamados.
  canCreateTicket: boolean;
  canEditTicket: boolean;
  canConcludeTicket: boolean;
  canChargeTicket: boolean;
  canDeleteTicket: boolean;

  // Usuários.
  canCreateUser: boolean;
  canChangeUserRole: boolean;
  canToggleUserStatus: boolean;
  canResetOwnPassword: boolean;
  canResetOtherUserPassword: boolean;
  canListUsers: boolean;
}

const adminPermissions: Permissions = {
  canView: true,
  canCreate: true,
  canEdit: true,
  canConclude: true,
  canCharge: true,
  canDelete: true,
  canManageUsers: true,

  canViewMobiles: true,
  canCreateMobile: true,
  canEditMobile: true,
  canDeleteMobile: true,
  canBulkUpdateMobiles: true,
  canChangeMobileStatus: true,
  canManageMobileMaintenance: true,
  canManageMobileConfig: true,

  canViewLoans: true,
  canCreateLoan: true,
  canReturnLoan: true,
  canClassifyLoanOccurrence: true,
  canIssueResponsibilityTerm: true,
  canEditOpenLoan: true,
  canCancelOpenLoan: true,
  canCorrectClosedLoanOccurrence: true,

  canCreateTicket: true,
  canEditTicket: true,
  canConcludeTicket: true,
  canChargeTicket: true,
  canDeleteTicket: true,

  canCreateUser: true,
  canChangeUserRole: true,
  canToggleUserStatus: true,
  canResetOwnPassword: true,
  canResetOtherUserPassword: true,
  canListUsers: true,
};

const analystPermissions: Permissions = {
  canView: true,
  canCreate: true,
  canEdit: true,
  canConclude: true,
  canCharge: true,
  canDelete: false,
  canManageUsers: true,

  canViewMobiles: true,
  canCreateMobile: true,
  canEditMobile: true,
  canDeleteMobile: false,
  canBulkUpdateMobiles: true,
  canChangeMobileStatus: true,
  canManageMobileMaintenance: true,
  canManageMobileConfig: false,

  canViewLoans: true,
  canCreateLoan: true,
  canReturnLoan: true,
  canClassifyLoanOccurrence: true,
  canIssueResponsibilityTerm: true,
  canEditOpenLoan: true,
  canCancelOpenLoan: true,
  canCorrectClosedLoanOccurrence: true,

  canCreateTicket: true,
  canEditTicket: true,
  canConcludeTicket: true,
  canChargeTicket: true,
  canDeleteTicket: true,

  canCreateUser: true,
  canChangeUserRole: true,
  canToggleUserStatus: true,
  canResetOwnPassword: true,
  canResetOtherUserPassword: true,
  canListUsers: true,
};

const viewerPermissions: Permissions = {
  canView: true,
  canCreate: false,
  canEdit: false,
  canConclude: false,
  canCharge: false,
  canDelete: false,
  canManageUsers: false,

  canViewMobiles: true,
  canCreateMobile: false,
  canEditMobile: false,
  canDeleteMobile: false,
  canBulkUpdateMobiles: false,
  canChangeMobileStatus: false,
  canManageMobileMaintenance: false,
  canManageMobileConfig: false,

  canViewLoans: false,
  canCreateLoan: false,
  canReturnLoan: false,
  canClassifyLoanOccurrence: false,
  canIssueResponsibilityTerm: false,
  canEditOpenLoan: false,
  canCancelOpenLoan: false,
  canCorrectClosedLoanOccurrence: false,

  canCreateTicket: false,
  canEditTicket: false,
  canConcludeTicket: false,
  canChargeTicket: false,
  canDeleteTicket: false,

  canCreateUser: false,
  canChangeUserRole: false,
  canToggleUserStatus: false,
  canResetOwnPassword: true,
  canResetOtherUserPassword: true,
  canListUsers: false,
};

export const ROLE_PERMISSIONS: Record<UserRole, Permissions> = {
  admin: adminPermissions,
  analyst: analystPermissions,
  viewer: viewerPermissions,
};

export const permissionMapToLegacy = (map: PermissionMap): Permissions => ({
  canView: map["tickets.view"],
  canCreate: map["tickets.create"],
  canEdit: map["tickets.edit"],
  canConclude: map["tickets.conclude"],
  canCharge: map["tickets.charge"],
  canDelete: map["tickets.delete"],
  canManageUsers: map["users.view"] || map["users.create"] || map["users.change_role"] || map["users.toggle_status"] || map["users.reset_other_password"] || map["permissions.manage"],
  canViewMobiles: map["mobiles.view"],
  canCreateMobile: map["mobiles.create"],
  canEditMobile: map["mobiles.edit"],
  canDeleteMobile: map["mobiles.delete"],
  canBulkUpdateMobiles: map["mobiles.bulk_update"],
  canChangeMobileStatus: map["mobiles.change_status"],
  canManageMobileMaintenance: map["maintenance.manage"],
  canManageMobileConfig: map["mobile_config.manage"],
  canViewLoans: map["loans.view"],
  canCreateLoan: map["loans.create"],
  canReturnLoan: map["loans.return"],
  canClassifyLoanOccurrence: map["loans.classify_occurrence"],
  canIssueResponsibilityTerm: map["loans.issue_responsibility_term"],
  canEditOpenLoan: map["loans.edit_open"],
  canCancelOpenLoan: map["loans.cancel_open"],
  canCorrectClosedLoanOccurrence: map["loans.correct_occurrence"],
  canCreateTicket: map["tickets.create"],
  canEditTicket: map["tickets.edit"],
  canConcludeTicket: map["tickets.conclude"],
  canChargeTicket: map["tickets.charge"],
  canDeleteTicket: map["tickets.delete"],
  canCreateUser: map["users.create"],
  canChangeUserRole: map["users.change_role"],
  canToggleUserStatus: map["users.toggle_status"],
  canResetOwnPassword: map["users.reset_own_password"],
  canResetOtherUserPassword: map["users.reset_other_password"],
  canListUsers: map["users.view"],
});

export const DEFAULT_LEGACY_ROLE_PERMISSIONS: Record<UserRole, Permissions> = {
  admin: permissionMapToLegacy(DEFAULT_ROLE_PERMISSIONS.admin),
  analyst: permissionMapToLegacy(DEFAULT_ROLE_PERMISSIONS.analyst),
  viewer: permissionMapToLegacy(DEFAULT_ROLE_PERMISSIONS.viewer),
};
