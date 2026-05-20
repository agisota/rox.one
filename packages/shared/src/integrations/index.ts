/**
 * Public surface for the integration framework primitive (PZD-78).
 *
 * Consumers import everything they need for declaring, validating, and
 * registering an integration from `@rox-one/shared/integrations` — never
 * deep-link into the individual modules.
 */

export {
  IntegrationManifestSchema,
  InProcessIntegrationManifestSchema,
  WebContentsViewIntegrationManifestSchema,
  LifecycleSchema,
  SkinSchema,
  NavigationSchema,
  TelemetrySchema,
  CapabilitiesSchema,
  BudgetSchema,
  parseIntegrationManifest,
  safeParseIntegrationManifest,
  type IntegrationManifest,
  type InProcessIntegrationManifest,
  type WebContentsViewIntegrationManifest,
  type IntegrationManifestParseResult,
} from './manifest.ts';

export {
  IntegrationRegistry,
  type ValidateAllResult,
} from './registry.ts';
