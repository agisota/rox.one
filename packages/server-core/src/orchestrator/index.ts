/**
 * Orchestrator host composition — M.7 T242.
 *
 * Re-exports the host factory + config parser. The T240 backbone types
 * stay in `@rox-one/shared/agent/backend/*` — this barrel only owns the
 * server-core composition layer.
 */

export {
  createHostOrchestrator,
  createHostOrchestratorOrThrow,
  createHostOrchestratorFromConfig,
  describeHostError,
  type CreateHostOrchestratorOptions,
  type HostOrchestratorError,
  type HostOrchestratorHandle,
} from './host.ts'

export {
  parseHostConfig,
  ROUTING_POLICY_KINDS,
  type FailoverPolicySpec,
  type HostBudgetConfig,
  type HostConfigParseError,
  type HostOrchestratorConfig,
  type RoundRobinPolicySpec,
  type RoutingPolicyKind,
  type RoutingPolicySpec,
  type StickyPolicySpec,
} from './host-config.ts'
