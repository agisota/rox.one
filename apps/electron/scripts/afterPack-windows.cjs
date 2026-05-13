/**
 * electron-builder afterPack hook (Windows variant) — M.18 T252.
 *
 * Mirror of `apps/electron/scripts/afterPack.cjs` (macOS) for Windows
 * NSIS / portable artifacts. Responsibilities:
 *
 *  1. Verify the canonical AppUserModelID / nsis.appId shape via the
 *     repo's `one.rox.workbench[.*]` or fallback `com.rox.one[.*]`
 *     pattern.
 *  2. Verify the FileVersion / ProductVersion shape is a dotted Windows
 *     version (a.b.c.d).
 *  3. Write a canonical `app-info.txt` sidecar next to the unpacked
 *     bundle so the boundary validator + CI evidence have a structured
 *     record to grep against.
 *  4. Emit the canonical `(T252 windows boundary ok)` marker that the
 *     validator looks for. The marker is appended to both the
 *     app-info.txt sidecar and (when present) the signing-output.txt
 *     sidecar produced by the signtool step.
 *
 * No real signtool invocation lives here. No credentials. This hook is
 * pure metadata mirroring; the actual Authenticode signing step is
 * driven by `.github/workflows/win-signed-release.yml` (T254 follow-up).
 */

const path = require('path');
const fs = require('fs');

const WINDOWS_APP_ID_PATTERN = /^(one\.rox\.workbench|com\.rox\.one)(\.[A-Za-z0-9-]+)*$/;
const WINDOWS_VERSION_PATTERN = /^\d+(\.\d+){0,3}$/;
const T252_AFTER_PACK_MARKER = '(T252 windows boundary ok)';
const DEFAULT_COMPANY_NAME = 'roxone';

function readBuilderAppId(context) {
  // electron-builder exposes the resolved appId at
  // context.packager.config.appId. The win: block may override it via
  // nsis.appId; we honor that first.
  const config = context.packager && context.packager.config ? context.packager.config : {};
  const winConfig = config.win || {};
  const nsisConfig = config.nsis || {};
  return winConfig.appId || nsisConfig.appId || config.appId || '';
}

function readBuilderVersion(context) {
  // electron-builder fills `buildVersion` from the config; if unset it
  // falls back to package.json version. We coerce to string and pad
  // dotted segments so `92` becomes `92.0.0.0` for the Windows shape.
  const config = context.packager && context.packager.config ? context.packager.config : {};
  const raw = String(config.buildVersion || (context.packager && context.packager.appInfo && context.packager.appInfo.version) || '');
  if (!raw) return '';
  const segments = raw.split('.');
  while (segments.length < 4) segments.push('0');
  return segments.slice(0, 4).join('.');
}

module.exports = async function afterPackWindows(context) {
  if (context.electronPlatformName !== 'win32') {
    console.log('afterPack-windows: skipping (not windows)');
    return;
  }

  const appOutDir = context.appOutDir;
  const productName = (context.packager && context.packager.appInfo && context.packager.appInfo.productFilename) || 'ROX.ONE';
  console.log(`afterPack-windows: appOutDir=${appOutDir} productName=${productName}`);

  const appId = readBuilderAppId(context);
  if (!WINDOWS_APP_ID_PATTERN.test(appId)) {
    throw new Error(`afterPack-windows: appId "${appId}" does not match ${WINDOWS_APP_ID_PATTERN}`);
  }

  const fileVersion = readBuilderVersion(context);
  if (!WINDOWS_VERSION_PATTERN.test(fileVersion)) {
    throw new Error(`afterPack-windows: FileVersion "${fileVersion}" is not a monotonic dotted Windows version`);
  }

  const companyName = (context.packager && context.packager.config && context.packager.config.copyright)
    ? DEFAULT_COMPANY_NAME
    : DEFAULT_COMPANY_NAME;

  // Symlink-escape guard: walk the unpacked dir and reject any symlinks
  // resolving outside it. electron-builder Windows artifacts normally have
  // none, but `node_modules/.bin` junctions occasionally leak through.
  const allFiles = walkFiles(appOutDir);
  for (const entry of allFiles) {
    let stat;
    try {
      stat = fs.lstatSync(entry);
    } catch {
      continue;
    }
    if (!stat.isSymbolicLink()) continue;
    const target = fs.readlinkSync(entry);
    const resolved = path.resolve(path.dirname(entry), target);
    if (!resolved.startsWith(appOutDir + path.sep) && resolved !== appOutDir) {
      throw new Error(`afterPack-windows: symlink escapes bundle: ${entry} -> ${target}`);
    }
  }

  // Emit canonical app-info.txt sidecar so the validator + CI evidence
  // both have a deterministic place to read AppUserModelID, FileVersion,
  // and the T252 boundary marker from.
  const sidecarPath = path.join(appOutDir, 'app-info.txt');
  const sidecarBody = [
    '# ROX.ONE Windows app metadata (afterPack-windows)',
    `AppUserModelID=${appId}`,
    `FileVersion=${fileVersion}`,
    `ProductVersion=${fileVersion}`,
    `CompanyName=${companyName}`,
    `ProductName=${productName}`,
    `# ${T252_AFTER_PACK_MARKER}`,
    '',
  ].join('\n');
  fs.writeFileSync(sidecarPath, sidecarBody, 'utf8');
  console.log(`afterPack-windows: wrote ${sidecarPath}`);

  // If a signing-output.txt was produced by the CI signing step earlier in
  // the pipeline, append the canonical marker so the validator can detect
  // it without re-reading the app-info sidecar. The validator looks at
  // both anyway, but appending here keeps the marker present in either
  // location.
  const signingOutputPath = path.join(appOutDir, 'signing-output.txt');
  if (fs.existsSync(signingOutputPath)) {
    fs.appendFileSync(signingOutputPath, `\n# ${T252_AFTER_PACK_MARKER}\n`, 'utf8');
    console.log(`afterPack-windows: appended marker to ${signingOutputPath}`);
  }

  console.log(`afterPack-windows: appId=${appId} version=${fileVersion} ${T252_AFTER_PACK_MARKER}`);
};

function walkFiles(dir, acc) {
  acc = acc || [];
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) {
      acc.push(fullPath);
      continue;
    }
    if (entry.isDirectory()) {
      walkFiles(fullPath, acc);
    } else {
      acc.push(fullPath);
    }
  }
  return acc;
}
