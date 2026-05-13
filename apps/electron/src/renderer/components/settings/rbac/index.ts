/**
 * Barrel export for the RBAC admin UI (T228). The settings page wires
 * `RolesPanel` and supplies the RPC adapter via `RolesPanelContext`.
 */

export { RolesPanel } from './RolesPanel'
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
