export type UserRole = "admin" | "analyst" | "viewer";

export const PERMISSION_KEYS = [
  "tickets.view", "tickets.create", "tickets.edit", "tickets.conclude", "tickets.charge", "tickets.delete",
  "mobiles.view", "mobiles.create", "mobiles.edit", "mobiles.delete", "mobiles.bulk_update", "mobiles.change_status",
  "maintenance.manage", "mobile_config.manage",
  "loans.view", "loans.create", "loans.return", "loans.classify_occurrence", "loans.issue_responsibility_term",
  "loans.edit_open", "loans.cancel_open", "loans.correct_occurrence",
  "users.view", "users.create", "users.change_role", "users.toggle_status", "users.reset_own_password",
  "users.reset_other_password", "permissions.manage",
] as const;

export type PermissionKey = typeof PERMISSION_KEYS[number];
export type PermissionMap = Record<PermissionKey, boolean>;

export const PERMISSION_CATALOG: Array<{ key: PermissionKey; group: string; label: string }> = [
  { key: "tickets.view", group: "Chamados", label: "Visualizar chamados" },
  { key: "tickets.create", group: "Chamados", label: "Criar chamados" },
  { key: "tickets.edit", group: "Chamados", label: "Editar chamados" },
  { key: "tickets.conclude", group: "Chamados", label: "Concluir chamados" },
  { key: "tickets.charge", group: "Chamados", label: "Gerenciar cobranças" },
  { key: "tickets.delete", group: "Chamados", label: "Excluir chamados" },
  { key: "mobiles.view", group: "Mobiles", label: "Visualizar mobiles" },
  { key: "mobiles.create", group: "Mobiles", label: "Cadastrar mobile" },
  { key: "mobiles.edit", group: "Mobiles", label: "Editar mobile" },
  { key: "mobiles.delete", group: "Mobiles", label: "Excluir mobile" },
  { key: "mobiles.bulk_update", group: "Mobiles", label: "Atualizar mobiles em lote" },
  { key: "mobiles.change_status", group: "Mobiles", label: "Alterar status do mobile" },
  { key: "maintenance.manage", group: "Mobiles", label: "Gerenciar manutenção" },
  { key: "mobile_config.manage", group: "Mobiles", label: "Gerenciar versões e APKs" },
  { key: "loans.view", group: "Empréstimos", label: "Visualizar empréstimos" },
  { key: "loans.create", group: "Empréstimos", label: "Criar empréstimo" },
  { key: "loans.return", group: "Empréstimos", label: "Finalizar empréstimo" },
  { key: "loans.classify_occurrence", group: "Empréstimos", label: "Classificar ocorrência" },
  { key: "loans.issue_responsibility_term", group: "Empréstimos", label: "Emitir termo de responsabilidade" },
  { key: "loans.edit_open", group: "Empréstimos", label: "Corrigir empréstimo aberto" },
  { key: "loans.cancel_open", group: "Empréstimos", label: "Cancelar empréstimo aberto" },
  { key: "loans.correct_occurrence", group: "Empréstimos", label: "Corrigir ocorrência finalizada" },
  { key: "users.view", group: "Usuários", label: "Visualizar usuários" },
  { key: "users.create", group: "Usuários", label: "Criar usuários" },
  { key: "users.change_role", group: "Usuários", label: "Alterar perfil de usuário" },
  { key: "users.toggle_status", group: "Usuários", label: "Ativar ou desativar usuário" },
  { key: "users.reset_own_password", group: "Usuários", label: "Alterar a própria senha" },
  { key: "users.reset_other_password", group: "Usuários", label: "Redefinir senha de outro usuário" },
  { key: "permissions.manage", group: "Usuários", label: "Gerenciar permissões dos perfis" },
];

const all = (enabled: boolean) => Object.fromEntries(PERMISSION_KEYS.map((key) => [key, enabled])) as PermissionMap;

const analyst: PermissionMap = {
  ...all(false),
  "tickets.view": true, "tickets.create": true, "tickets.edit": true, "tickets.conclude": true,
  "tickets.charge": true, "tickets.delete": true,
  "mobiles.view": true, "mobiles.create": true, "mobiles.edit": true, "mobiles.bulk_update": true,
  "mobiles.change_status": true, "maintenance.manage": true,
  "loans.view": true, "loans.create": true, "loans.return": true, "loans.classify_occurrence": true,
  "loans.issue_responsibility_term": true, "loans.edit_open": true, "loans.cancel_open": true,
  "loans.correct_occurrence": true,
  "users.view": true, "users.create": true, "users.change_role": true, "users.toggle_status": true,
  "users.reset_own_password": true, "users.reset_other_password": true,
};

const viewer: PermissionMap = { ...all(false), "tickets.view": true, "mobiles.view": true, "users.reset_own_password": true };

export const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, PermissionMap> = {
  admin: all(true), analyst, viewer,
};

export const isPermissionKey = (value: unknown): value is PermissionKey =>
  typeof value === "string" && (PERMISSION_KEYS as readonly string[]).includes(value);

