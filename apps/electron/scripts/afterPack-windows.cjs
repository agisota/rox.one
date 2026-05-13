/**
 * electron-builder afterPack hook (Windows variant) — M.18 T252.
 * Mirror of apps/electron/scripts/afterPack.cjs (macOS) for Windows.
 * Validates canonical AppUserModelID + dotted FileVersion shape, writes
 * app-info.txt sidecar, emits canonical (T252 windows boundary ok)
 * marker into app-info.txt and (when present) signing-output.txt.
 * No signtool invocation, no credentials — T254 follow-up adds those.
 */

const path = require('path');
const fs = require('fs');

const WINDOWS_APP_ID_PATTERN = /^(one\.rox\.workbench|com\.rox\.one)(\.[A-Za-z0-9-]+)*$/;
const WINDOWS_VERSION_PATTERN = /^\d+(\.\d+){0,3}$/;
const T252_AFTER_PACK_MARKER = '(T252 windows boundary ok)';
const DEFAULT_COMPANY_NAME = 'roxone';

function readBuilderAppId(context) {
  // win.appId / nsis.appId override the top-level appId when set.
  const config = context.packager && context.packager.config ? context.packager.config : {};
  const winConfig = config.win || {};
  const nsisConfig = config.nsis || {};
  return winConfig.appId || nsisConfig.appId || config.appId || '';
}

function readBuilderVersion(context) {
  // Pad dotted segments so `92` becomes `92.0.0.0` for the Windows shape.
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

  const companyName = DEFAULT_COMPANY_NAME;

  // Symlink-escape guard: reject any symlink resolving outside the dir.
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
  // and CI evidence both have a deterministic record + T252 marker.
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

  // If CI signing step left a signing-output.txt, append the marker so
  // the validator catches it whichever sidecar it reads first.
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
