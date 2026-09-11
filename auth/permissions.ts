export type UserRole =
  | "admin"
  | "analyst"
  | "viewer";

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