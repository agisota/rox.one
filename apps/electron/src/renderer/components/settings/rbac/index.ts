/**
 * Barrel export for the RBAC admin UI.
 *
 * T228 introduced `RolesPanel` (role-grouped catalogue + mutation
 * forms). T231 adds `TeamManagementPanel`, a second admin surface that
 * groups the same grant list by actor so admins can audit "who has
 * what" at a glance. Both panels share `RolesPanelContext` so the
 * settings page wraps a single RPC adapter once and routes per-tab.
 */

export { RolesPanel } from './RolesPanel'
export { TeamManagementPanel, type TeamManagementPanelProps } from './TeamManagementPanel'
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
