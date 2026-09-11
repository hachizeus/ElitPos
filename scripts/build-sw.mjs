/**
 * ElitPOS — Service Worker Build Script
 *
 * Copies the correct sw.js to public/ based on NODE_ENV:
 *   - development → public/sw.js = stub (no fetch interception)
 *   - production  → public/sw.js = full offline SW
 *
 * Run automatically via the `prebuild` npm script.
 */

import { copyFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const isDev = process.env.NODE_ENV !== 'production'

const stubSw = join(root, 'src', 'lib', 'sw', 'sw-stub.js')
const productionSw = join(root, 'src', 'lib', 'sw', 'sw-production.js')
const dest = join(root, 'public', 'sw.js')

// In dev mode we leave public/sw.js as-is (it's already the safe stub)
if (!isDev) {
  if (!existsSync(productionSw)) {
    console.error('[build-sw] Production SW not found:', productionSw)
    process.exit(1)
  }
  copyFileSync(productionSw, dest)
  console.log('[build-sw] ✓ Copied production SW to public/sw.js')
} else {
  console.log('[build-sw] Development mode — keeping stub SW (no fetch interception)')
}
