/**
 * Backward-compatible environment variable reader for the ROX.ONE rebrand.
 *
 * Reads the canonical `ROX_*` environment variable when set. Falls back to
 * the matching legacy `CRAFT_*` variable for one minor version, emitting a
 * single deprecation warning on stderr the first time each legacy name is
 * observed in the current process.
 *
 * The legacy `CRAFT_*` fallback is scheduled for removal in the minor
 * release following the one that ships this shim. See Phase R.6 of the
 * rebrand-sweep goal doc for the policy.
 */

const LEGACY_PREFIX = 'CRAFT' + '_';
const NEW_PREFIX = 'ROX_';

const warnedLegacyEnvVars = new Set<string>();

function emitEnvDeprecationWarning(legacyName: string, newName: string): void {
  if (warnedLegacyEnvVars.has(legacyName)) return;
  warnedLegacyEnvVars.add(legacyName);
  console.warn(
    `[env] ${legacyName} is deprecated; use ${newName}. ` +
      'The legacy ' +
      LEGACY_PREFIX +
      '* fallback will be removed after one minor version.',
  );
}

/**
 * Read an environment variable, preferring the canonical `ROX_*` name and
 * falling back to the legacy `CRAFT_*` name with a one-time deprecation
 * warning.
 *
 * @param name - The canonical environment variable name (e.g. `ROX_DEBUG`).
 *   Names not starting with `ROX_` are looked up directly without any
 *   legacy fallback.
 */
export function readEnv(name: string): string | undefined {
  const value = process.env[name];
  if (value !== undefined) return value;
  if (name.startsWith(NEW_PREFIX)) {
    const legacy = LEGACY_PREFIX + name.slice(NEW_PREFIX.length);
    const legacyValue = process.env[legacy];
    if (legacyValue !== undefined) {
      emitEnvDeprecationWarning(legacy, name);
      return legacyValue;
    }
  }
  return undefined;
}

/**
 * Test-only helper: clears the per-process set of legacy environment
 * variable names that have already emitted their deprecation warning.
 *
 * Not part of the public runtime contract; only re-exported from the utils
 * barrel for the shim's own unit tests. Production code MUST NOT call this.
 */
export function __resetEnvCompatWarningsForTests(): void {
  warnedLegacyEnvVars.clear();
}
