/**
 * Smoke test for patched markitdown-js@0.0.14
 *
 * Verifies:
 * 1. The patched package loads without error (xmldom -> @xmldom/xmldom, tesseract removed)
 * 2. DOMParser from @xmldom/xmldom is available at runtime
 * 3. markitdown-js MarkItDown class can be instantiated
 * 4. Plain-text conversion still returns textContent
 *
 * Run: node scripts/smoke-markitdown-patch.mjs
 */
import { writeFileSync, unlinkSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

let passed = 0
let failed = 0

function ok(label) {
  console.log(`  PASS  ${label}`)
  passed++
}

function fail(label, err) {
  console.error(`  FAIL  ${label}: ${err}`)
  failed++
}

// 1. Verify @xmldom/xmldom DOMParser is importable
try {
  const { DOMParser } = await import('@xmldom/xmldom')
  const parser = new DOMParser()
  const doc = parser.parseFromString('<root><item>hello</item></root>', 'text/xml')
  const item = doc.getElementsByTagName('item')[0]
  if (item && item.textContent === 'hello') {
    ok('@xmldom/xmldom DOMParser parses XML correctly')
  } else {
    fail('@xmldom/xmldom DOMParser', 'unexpected parse result')
  }
} catch (e) {
  fail('@xmldom/xmldom DOMParser import', e.message)
}

// 2. Verify markitdown-js loads without requiring node-tesseract-ocr
try {
  const { MarkItDown } = await import('markitdown-js')
  ok('markitdown-js imports without node-tesseract-ocr error')

  // 3. Instantiate and convert a plain text file
  const tmpFile = join(tmpdir(), `smoke-test-${Date.now()}.txt`)
  writeFileSync(tmpFile, 'ROX markitdown patch smoke test — Office files still convert.', 'utf-8')

  try {
    const md = new MarkItDown()
    const result = await md.convert(tmpFile)
    if (result && typeof result.textContent === 'string' && result.textContent.includes('ROX markitdown patch')) {
      ok('MarkItDown.convert() returns expected textContent for plain text')
    } else {
      fail('MarkItDown.convert() plain text', `unexpected result: ${JSON.stringify(result)}`)
    }
  } finally {
    unlinkSync(tmpFile)
  }
} catch (e) {
  fail('markitdown-js load/convert', e.message)
}

// 4. Verify markitdown-js patched dist does NOT reference node-tesseract-ocr
// Note: the package may still be in node_modules (lockfile), but markitdown-js no longer require()s it
import { readFileSync } from 'fs'
import { resolve } from 'path'
try {
  const cjsDist = readFileSync(
    resolve('node_modules/markitdown-js/dist/markitdown.cjs'), 'utf-8'
  )
  const esmDist = readFileSync(
    resolve('node_modules/markitdown-js/dist/markitdown.js'), 'utf-8'
  )
  if (cjsDist.includes('require("node-tesseract-ocr")') || esmDist.includes('from "node-tesseract-ocr"')) {
    fail('markitdown-js dist still imports node-tesseract-ocr', 'found live require/import')
  } else {
    ok('markitdown-js dist does not require/import node-tesseract-ocr')
  }
  if (cjsDist.includes('require("xmldom")') || esmDist.includes('from "xmldom"')) {
    fail('markitdown-js dist still imports vulnerable xmldom', 'found live require/import')
  } else {
    ok('markitdown-js dist does not require/import vulnerable xmldom')
  }
} catch (e) {
  fail('dist content check', e.message)
}

console.log('')
console.log(`Results: ${passed} passed, ${failed} failed`)
if (failed > 0) {
  process.exit(1)
}
