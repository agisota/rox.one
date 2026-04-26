import { valid as isValidSemver } from 'semver';
import { fileURLToPath } from 'url';

type PackageJson = {
  version?: string;
  name?: string;
};

async function readPackageJson(path: string): Promise<PackageJson> {
  return (await Bun.file(path).json()) as PackageJson;
}

function assertVersion(label: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`${label} version is missing`);
  }

  if (!isValidSemver(value)) {
    throw new Error(`${label} version is not valid semver: ${value}`);
  }

  return value;
}

async function main(): Promise<void> {
  const rootPackage = await readPackageJson(fileURLToPath(new URL('../package.json', import.meta.url)));
  const electronPackage = await readPackageJson(
    fileURLToPath(new URL('../apps/electron/package.json', import.meta.url))
  );

  const rootVersion = assertVersion('root package', rootPackage.version);
  const electronVersion = assertVersion('electron package', electronPackage.version);

  if (rootVersion !== electronVersion) {
    throw new Error(
      `Version mismatch: root package is ${rootVersion}, electron package is ${electronVersion}`
    );
  }

  console.log(`Version check OK: ${rootVersion}`);
}

await main();
