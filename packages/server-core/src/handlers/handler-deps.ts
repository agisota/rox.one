import type { PlatformServices } from '../runtime/platform'
import type { ISessionManager } from './session-manager-interface'
import type { IOAuthFlowStore } from './oauth-flow-store-interface'
import type { IBrowserPaneManager } from './browser-pane-manager-interface'
import type { IWindowManager } from './window-manager-interface'
import type { IMessagingGatewayRegistry } from './messaging-registry-interface'
import type { AccountStore } from '../accounts'
import type { OfficeDocumentConverter } from '../services/office-document-adapter'
import type { RbacResolver } from '@rox-one/shared/auth/rbac-resolver'

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
  officeDocumentConverter?: OfficeDocumentConverter
}
