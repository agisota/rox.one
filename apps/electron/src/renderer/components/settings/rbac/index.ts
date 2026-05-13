/**
 * Barrel export for the RBAC admin UI.
 *
 * T228 introduced `RolesPanel` (role-grouped catalogue + mutation
 * forms). T231 adds `TeamManagementPanel`, a second admin surface that
 * groups the same grant list by actor so admins can audit "who has
 * what" at a glance. T232 adds `AuditLogPanel`, a read-only admin
 * surface that reads the hash-chained audit log T246 populates from
 * RBAC + mission events. All three panels live under
 * `/settings/team-*` and share the existing settings page chrome.
 */

export { RolesPanel } from './RolesPanel'
export { TeamManagementPanel, type TeamManagementPanelProps } from './TeamManagementPanel'
export {
  AuditLogPanel,
  AuditLogPanelContext,
  createInMemoryAuditEventSource,
  useAuditLogPanelContext,
  type AuditEventSource,
  type AuditLogPanelContextValue,
  type AuditLogPanelProps,
} from './AuditLogPanel'
export { ActorRow, type ActorRowProps } from './ActorRow'
export {
  RolesPanelContext,
  useRolesPanelContext,
  type RolesPanelContextValue,
  type RolesPanelInitialState,
  type RolesPanelRpcClient,
} from './RolesPanelContext'
export {
  CreateRoleForm,
  buildCreateRolePayload,
  type CreateRoleFormFields,
  type CreateRoleFormProps,
} from './CreateRoleForm'
export {
  GrantRoleForm,
  buildGrantRolePayload,
  type GrantRoleFormFields,
  type GrantRoleFormProps,
} from './GrantRoleForm'
export {
  RevokeButton,
  performRevoke,
  type PerformRevokeInput,
  type RevokeButtonProps,
  type RevokeResult,
} from './RevokeButton'
export {
  createInitialRolesPanelState,
  rolesPanelReducer,
  selectIsOwner,
  type RolesPanelAction,
  type RolesPanelState,
  type RolesPanelStatus,
} from './roles-panel-state'
export {
  actorRowKey,
  createInitialTeamManagementState,
  grantKey,
  grantsMatch,
  selectActorCount,
  selectActorRows,
  selectIsOwner as selectIsOwnerForTeamView,
  teamManagementReducer,
  type ActorGrantEntry,
  type ActorRowView,
  type TeamManagementAction,
  type TeamManagementState,
  type TeamManagementStatus,
} from './team-management-state'
export {
  actorIdentity,
  auditLogReducer,
  createInitialAuditLogState,
  DEFAULT_AUDIT_PAGE_SIZE,
  dayKey,
  EMPTY_AUDIT_FILTERS,
  eventMatchesFilters,
  selectActorCount as selectAuditActorCount,
  selectAuditLogView,
  type AuditLogAction,
  type AuditLogDayGroup,
  type AuditLogFilters,
  type AuditLogState,
  type AuditLogStatus,
  type AuditLogView,
  type CreateInitialAuditLogStateInput,
} from './audit-log-state'
