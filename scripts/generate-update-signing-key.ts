#!/usr/bin/env bun
/**
 * Generate an EdDSA (ed25519) keypair for ROX.ONE auto-update manifest signing.
 *
 * Prints both keys to stdout — does NOT write to disk to avoid accidentally
 * committing the private key. Copy each block to its destination manually:
 *   - PRIVATE → GH Actions secret ROX_UPDATE_PRIVATE_KEY
 *   - PUBLIC  → GH variable / build env ROX_UPDATE_PUBLIC_KEY
 *
 * See SECURITY.md "Auto-update signature verification (EdDSA)" for the full
 * trust model and rotation procedure.
 */
import { generateKeyPairSync } from 'node:crypto'

const { publicKey, privateKey } = generateKeyPairSync('ed25519')

const privPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()

// electron-updater accepts publicKey as bare base64 of the raw EdDSA pubkey
// (32 bytes). Extract from PEM by parsing the DER and stripping the SPKI wrapper.
const der = publicKey.export({ type: 'spki', format: 'der' })
// Last 32 bytes of SPKI-DER for ed25519 = raw pubkey
const rawPub = der.subarray(der.length - 32)
const pubBase64 = rawPub.toString('base64')

console.log('========================================')
console.log('  ROX.ONE auto-update signing keypair')
console.log('========================================')
console.log()
console.log('STEP 1 — Copy this to GitHub Actions secret ROX_UPDATE_PRIVATE_KEY:')
console.log()
console.log(privPem)
console.log('STEP 2 — Copy this to GH variable or env ROX_UPDATE_PUBLIC_KEY (base64 raw pubkey, 44 chars):')
console.log()
console.log(pubBase64)
console.log()
console.log('STEP 3 — Tag a new release. The build will embed ROX_UPDATE_PUBLIC_KEY into the app via esbuild --define.')
console.log('STEP 4 — CI signing of latest-*.yml manifests is a SEPARATE PR (#370 part 4). Until that lands, the publicKey is embedded but updates remain unsigned. Auto-install-on-quit is disabled in this safety-belt state.')
console.log()
console.log('IMPORTANT: store ROX_UPDATE_PRIVATE_KEY in a password manager AND offline backup. Loss = unable to sign future updates without rotating to a new keypair (forces user-side reinstall via install-app.sh).')
