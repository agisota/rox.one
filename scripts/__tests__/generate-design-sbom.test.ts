/**
 * T537 PR #5b: TDD cycles 11-12 — CycloneDX SBOM for vendored Open Design.
 *
 * Verifies that generate-design-sbom.ts produces a structurally valid
 * CycloneDX SBOM containing the @nexu-io/open-design component entry.
 */
import { describe, expect, it } from 'bun:test'
import { generateDesignSbom, type DesignSbomInput } from '../generate-design-sbom'

const MINIMAL_INPUT: DesignSbomInput = {
  packageName: '@nexu-io/open-design',
  version: '0.0.0-vendored',
  description: 'Open Design vendored runtime bundled with ROX',
  homepage: 'https://github.com/nexu-io/open-design',
  licenses: ['MIT'],
}

describe('generateDesignSbom', () => {
  it('produces a CycloneDX 1.5+ SBOM document', () => {
    const sbom = generateDesignSbom(MINIMAL_INPUT)
    expect(sbom.bomFormat).toBe('CycloneDX')
    const version = parseFloat(String(sbom.specVersion))
    expect(version).toBeGreaterThanOrEqual(1.5)
    expect(typeof sbom.serialNumber).toBe('string')
    expect(sbom.serialNumber).toMatch(/^urn:uuid:/)
  })

  it('contains a component entry for @nexu-io/open-design', () => {
    const sbom = generateDesignSbom(MINIMAL_INPUT)
    expect(Array.isArray(sbom.components)).toBe(true)
    const component = sbom.components.find(
      (c) => c.name === '@nexu-io/open-design',
    )
    expect(component).toBeDefined()
    expect(component?.version).toBe('0.0.0-vendored')
    expect(component?.type).toBe('library')
  })

  it('includes license information in the component', () => {
    const sbom = generateDesignSbom(MINIMAL_INPUT)
    const component = sbom.components.find((c) => c.name === '@nexu-io/open-design')
    expect(component?.licenses).toBeDefined()
    expect(component?.licenses?.length).toBeGreaterThan(0)
    const licenseEntry = component?.licenses?.[0]
    expect(licenseEntry?.license?.id ?? licenseEntry?.license?.name).toBe('MIT')
  })

  it('includes a purl for the component', () => {
    const sbom = generateDesignSbom(MINIMAL_INPUT)
    const component = sbom.components.find((c) => c.name === '@nexu-io/open-design')
    expect(component?.purl).toMatch(/pkg:npm\/%40nexu-io\/open-design@/)
  })

  it('includes metadata with timestamp and tool info', () => {
    const sbom = generateDesignSbom(MINIMAL_INPUT)
    expect(sbom.metadata).toBeDefined()
    expect(typeof sbom.metadata?.timestamp).toBe('string')
    // Timestamp should be ISO 8601
    expect(() => new Date(sbom.metadata!.timestamp)).not.toThrow()
    expect(sbom.metadata?.tools).toBeDefined()
  })

  it('serialises to valid JSON', () => {
    const sbom = generateDesignSbom(MINIMAL_INPUT)
    const json = JSON.stringify(sbom, null, 2)
    expect(() => JSON.parse(json)).not.toThrow()
    const parsed = JSON.parse(json) as typeof sbom
    expect(parsed.bomFormat).toBe('CycloneDX')
  })

  it('accepts custom version from input', () => {
    const sbom = generateDesignSbom({ ...MINIMAL_INPUT, version: '1.2.3' })
    const component = sbom.components.find((c) => c.name === '@nexu-io/open-design')
    expect(component?.version).toBe('1.2.3')
    expect(component?.purl).toContain('1.2.3')
  })
})
