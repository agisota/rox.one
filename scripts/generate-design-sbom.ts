#!/usr/bin/env bun
/**
 * T537 PR #5b: CycloneDX SBOM generator for vendored Open Design.
 *
 * Produces a CycloneDX 1.5 SBOM entry for the @nexu-io/open-design
 * vendored dependency bundled inside the ROX Electron app.
 *
 * Usage: bun run scripts/generate-design-sbom.ts [--out=<path>]
 *
 * Writes JSON to stdout (or --out file) and exits 0 on success.
 */
import { randomUUID } from 'node:crypto'

// ---------------------------------------------------------------------------
// Types (CycloneDX 1.5 subset)
// ---------------------------------------------------------------------------

interface CycloneDxLicense {
  license: {
    id?: string
    name?: string
    url?: string
  }
}

interface CycloneDxComponent {
  type: 'library' | 'application' | 'framework' | 'container' | 'device' | 'firmware'
  name: string
  version: string
  description?: string
  purl?: string
  licenses?: CycloneDxLicense[]
  externalReferences?: Array<{ type: string; url: string }>
}

interface CycloneDxMetadata {
  timestamp: string
  tools: Array<{ vendor: string; name: string; version: string }>
}

export interface CycloneDxSbom {
  bomFormat: 'CycloneDX'
  specVersion: string
  serialNumber: string
  version: number
  metadata: CycloneDxMetadata
  components: CycloneDxComponent[]
}

// ---------------------------------------------------------------------------
// Input type
// ---------------------------------------------------------------------------

export interface DesignSbomInput {
  packageName: string
  version: string
  description?: string
  homepage?: string
  licenses: string[]
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

/**
 * Generate a CycloneDX 1.5 SBOM document for the given design dependency input.
 */
export function generateDesignSbom(input: DesignSbomInput): CycloneDxSbom {
  const { packageName, version, description, homepage, licenses } = input

  // Build package URL (purl) per pkg:npm spec.
  // Scoped packages like @nexu-io/open-design need the @ encoded as %40.
  const encodedName = packageName.startsWith('@')
    ? '%40' + packageName.slice(1)
    : packageName
  const purl = 'pkg:npm/' + encodedName + '@' + encodeURIComponent(version)

  const licenseEntries: CycloneDxLicense[] = licenses.map((spdxId) => ({
    license: { id: spdxId },
  }))

  const externalRefs: CycloneDxComponent['externalReferences'] = []
  if (homepage) {
    externalRefs.push({ type: 'website', url: homepage })
  }

  const component: CycloneDxComponent = {
    type: 'library',
    name: packageName,
    version,
    ...(description ? { description } : {}),
    purl,
    licenses: licenseEntries,
    ...(externalRefs.length > 0 ? { externalReferences: externalRefs } : {}),
  }

  return {
    bomFormat: 'CycloneDX',
    specVersion: '1.5',
    serialNumber: 'urn:uuid:' + randomUUID(),
    version: 1,
    metadata: {
      timestamp: new Date().toISOString(),
      tools: [
        {
          vendor: 'ROX',
          name: 'generate-design-sbom',
          version: '1.0.0',
        },
      ],
    },
    components: [component],
  }
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

if (import.meta.main) {
  const args = process.argv.slice(2)
  const outArg = args.find((a) => a.startsWith('--out='))
  const outPath = outArg ? outArg.slice('--out='.length) : undefined

  const input: DesignSbomInput = {
    packageName: '@nexu-io/open-design',
    version: process.env.ROX_DESIGN_VERSION ?? '0.0.0-vendored',
    description: 'Open Design vendored runtime bundled with ROX',
    homepage: 'https://github.com/nexu-io/open-design',
    licenses: ['MIT'],
  }

  const sbom = generateDesignSbom(input)
  const json = JSON.stringify(sbom, null, 2)

  if (outPath) {
    const { writeFileSync, mkdirSync } = await import('node:fs')
    const { dirname } = await import('node:path')
    mkdirSync(dirname(outPath), { recursive: true })
    writeFileSync(outPath, json, 'utf-8')
    console.log('[generate-design-sbom] SBOM written to ' + outPath)
  } else {
    process.stdout.write(json + '\n')
  }
}
