const { execFileSync } = require('node:child_process');
const { existsSync } = require('node:fs');
const { join, resolve } = require('node:path');

exports.default = async function beforeBuild() {
  // B-CI-1 (Linear PZD-48) — defence-in-depth Rox Design payload gate.
  //
  // The `rox-design:payload:verify` script lives in package.json and is wired
  // into every `bun run electron:dist*` entry. Several release workflows call
  // `bunx electron-builder` directly, bypassing the bun-script chain (and thus
  // the gate). Running the verifier here ensures every signed/unsigned release
  // path is gated regardless of how electron-builder is invoked.
  //
  // Honour `ROX_SKIP_ROX_DESIGN_PAYLOAD_VERIFY=1` for parity with the
  // npm-script chain (dev smokes that intentionally skip Rox Design).
  if (process.env.ROX_SKIP_ROX_DESIGN_PAYLOAD_VERIFY === '1') {
    console.log(
      '[electron-builder] rox-design payload verify SKIPPED (ROX_SKIP_ROX_DESIGN_PAYLOAD_VERIFY=1)',
    );
  } else {
    // beforeBuild.cjs lives at <repo>/apps/electron/scripts; the verifier lives
    // at <repo>/scripts. Three `..` from __dirname reach the repo root.
    const rootDir = resolve(__dirname, '..', '..', '..');
    const verifier = join(rootDir, 'scripts', 'check-rox-design-runtime-payload.ts');
    if (!existsSync(verifier)) {
      throw new Error(
        `[electron-builder] Rox Design payload verifier is missing at ${verifier}. ` +
          'Refusing to package without the gate. Restore the verifier or set ' +
          'ROX_SKIP_ROX_DESIGN_PAYLOAD_VERIFY=1 to skip (dev only).',
      );
    }
    console.log('[electron-builder] running rox-design payload verify (B-CI-1 gate)');
    execFileSync('bun', ['run', verifier], { cwd: rootDir, stdio: 'inherit' });
  }

  console.log(
    '[electron-builder] node_modules handled by explicit bundles and extraResources; skipping automatic dependency collection',
  );
  return false;
};
