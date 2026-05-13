import type { PlatformServices } from '../runtime/platform'
import type { ISessionManager } from './session-manager-interface'
import type { IOAuthFlowStore } from './oauth-flow-store-interface'
import type { IBrowserPaneManager } from './browser-pane-manager-interface'
import type { IWindowManager } from './window-manager-interface'
import type { IMessagingGatewayRegistry } from './messaging-registry-interface'
import type { AccountStore } from '../accounts'
import type { OfficeDocumentConverter } from '../services/office-document-adapter'
import type { RbacResolver, GrantStore } from '@rox-one/shared/auth/rbac-resolver'
import type { RoleStore } from '@rox-one/shared/auth/role-store'
import type { AuditProducer } from '@rox-one/shared/observability'
import type { TokenBucket } from '@rox-one/shared/security'
import type { MissionScheduler } from '../missions'

/**
 * Generic handler dependency bag.
 * Concrete hosts specialize these generics to their runtime implementations.
 *
 * TSessionManager defaults to ISessionManager, TOAuthFlowStore
 * defaults to IOAuthFlowStore, TWindowManager defaults to IWindowManager,
 * and TBrowserPaneManager defaults to IBrowserPaneManager so core handlers
 * get typed access without specialization.  Electron narrows all to their
 * concrete implementations.
 */
export interface HandlerDeps<
  TSessionManager extends ISessionManager = ISessionManager,
  TOAuthFlowStore extends IOAuthFlowStore = IOAuthFlowStore,
  TWindowManager extends IWindowManager = IWindowManager,
  TBrowserPaneManager extends IBrowserPaneManager = IBrowserPaneManager,
> {
  sessionManager: TSessionManager
  platform: PlatformServices
  windowManager?: TWindowManager
  browserPaneManager?: TBrowserPaneManager
  oauthFlowStore: TOAuthFlowStore
  messagingRegistry?: IMessagingGatewayRegistry
  accountStore?: AccountStore
  /**
   * Optional RBAC resolver (T226). When provided, the RPC scope helpers
   * source `session.permittedWorkspaces` from this resolver instead of
   * `accountStore.listWorkspaceIds`. Hosts that have not yet adopted RBAC
   * may omit this field; behaviour then matches the C.4 baseline path.
   */
  rbacResolver?: RbacResolver
  /**
   * Optional grant store (T227). The admin RPC handlers
   * (`roles.grant`, `roles.revoke`) mutate this store. Hosts that have
   * not yet adopted the admin RPC may omit this field; the mutating
   * handlers then return `{error: 'rbac-not-configured', reason: 'no-grant-store'}`.
   */
  grantStore?: GrantStore
  /**
   * Optional role catalog store (T227). `roles.create` appends custom
   * roles here. `roles.list` consults it when present; when absent it
   * falls back to `SYSTEM_ROLES` so the catalog remains universally
   * readable even without admin wiring.
   */
  roleStore?: RoleStore
  /**
   * Optional audit producer (T246). When provided, the RBAC admin handlers
   * (`roles.grant`, `roles.revoke`) emit `RoleGranted` / `RoleRevoked`
   * audit events on their success path. Hosts that have not yet adopted
   * the observability surface may omit this field; emission becomes a
   * no-op and the handlers behave identically to the pre-T246 baseline.
   */
  auditProducer?: AuditProducer
  /**
   * Optional mission scheduler (T241). The mission admin RPC handlers
   * (`missions.create`, `missions.dispatchEvent`, `missions.get`,
   * `missions.list`) call through this scheduler. Hosts that have not
   * yet adopted the M.8 mission surface may omit this field; the
   * handlers then respond with `{error: 'missions-not-configured'}`.
   */
  missionScheduler?: MissionScheduler
  /**
   * Optional rate limiter (T071b). When provided, the RBAC admin RPC
   * handlers (`roles.grant`, `roles.revoke`) call `tryAcquire(1)` at
   * the entry of each request and respond with
   * `{error: 'rate-limited', reason: 'token-bucket-exhausted'}` when
   * the bucket is empty. The check runs BEFORE the grant store mutation
   * and BEFORE audit emission, so a rate-limited request leaves no
   * state change and no audit record. Hosts that omit this field
   * behave identically to the pre-T071b baseline (no rate limiting).
   * The bucket lifetime/scoping is the host's responsibility — a single
   * shared bucket caps the whole RBAC admin surface, while per-actor
   * buckets are achievable by wrapping the deps construction.
   */
  rateLimiter?: TokenBucket
  officeDocumentConverter?: OfficeDocumentConverter
}
