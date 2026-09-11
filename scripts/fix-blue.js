// Replaces all blue Tailwind classes with the brand green equivalents
// across the setup wizard files specifically.
// Run: node scripts/fix-blue.js
const fs = require('fs')
const path = require('path')

// Map: blue class → green equivalent
// We map blue-* shades to their closest green/emerald counterparts
// keeping the same shade number so contrast ratios are preserved.
const replacements = [
  // ── Backgrounds ────────────────────────────────────────────────
  [/bg-blue-50/g,        'bg-green-50'],
  [/bg-blue-100/g,       'bg-green-100'],
  [/bg-blue-500/g,       'bg-[#00FF88]'],
  [/bg-blue-600/g,       'bg-[#00e67a]'],
  [/bg-blue-700/g,       'bg-[#00cc6e]'],
  [/bg-blue-800\/40/g,   'bg-green-800/40'],
  [/bg-blue-900\/15/g,   'bg-green-900/15'],
  [/bg-blue-900\/20/g,   'bg-green-900/20'],
  [/bg-blue-900\/30/g,   'bg-green-900/30'],
  [/bg-blue-900\/40/g,   'bg-green-900/40'],
  [/bg-blue-900\/50/g,   'bg-green-900/50'],
  [/bg-blue-950\/20/g,   'bg-green-950/20'],
  [/bg-blue-950\/30/g,   'bg-green-950/30'],

  // ── Text ───────────────────────────────────────────────────────
  [/text-blue-100/g,  'text-green-100'],
  [/text-blue-300/g,  'text-green-300'],
  [/text-blue-400/g,  'text-green-400'],
  [/text-blue-500/g,  'text-[#00FF88]'],
  [/text-blue-600/g,  'text-[#00cc6e]'],
  [/text-blue-700/g,  'text-green-700'],
  [/text-blue-800/g,  'text-green-800'],
  [/text-blue-900/g,  'text-green-900'],

  // ── Borders ────────────────────────────────────────────────────
  [/border-blue-100/g,   'border-green-100'],
  [/border-blue-200/g,   'border-green-200'],
  [/border-blue-300/g,   'border-green-300'],
  [/border-blue-400/g,   'border-green-400'],
  [/border-blue-500/g,   'border-[#00FF88]'],
  [/border-blue-600/g,   'border-[#00cc6e]'],
  [/border-blue-700/g,   'border-green-700'],
  [/border-blue-800/g,   'border-green-800'],

  // ── Gradients ──────────────────────────────────────────────────
  [/from-blue-50\/80/g,  'from-green-50/80'],
  [/from-blue-950\/20/g, 'from-green-950/20'],
  [/from-blue-500/g,     'from-[#00FF88]'],
  [/from-blue-600/g,     'from-[#00e67a]'],
  [/to-blue-50\/30/g,    'to-green-50/30'],
  [/to-blue-50\/40/g,    'to-green-50/40'],
  [/to-blue-500/g,       'to-[#00FF88]'],
  [/to-blue-600/g,       'to-[#00e67a]'],
  [/to-blue-700/g,       'to-[#00cc6e]'],

  // ── Hover backgrounds ──────────────────────────────────────────
  [/hover:bg-blue-50/g,       'hover:bg-green-50'],
  [/hover:bg-blue-100/g,      'hover:bg-green-100'],
  [/hover:bg-blue-700/g,      'hover:bg-[#00cc6e]'],
  [/hover:bg-blue-800/g,      'hover:bg-[#00b35e]'],
  [/hover:bg-blue-900\/20/g,  'hover:bg-green-900/20'],
  [/hover:bg-blue-950\/30/g,  'hover:bg-green-950/30'],

  // ── Hover text ─────────────────────────────────────────────────
  [/hover:text-blue-100/g, 'hover:text-green-100'],
  [/hover:text-blue-400/g, 'hover:text-green-400'],
  [/hover:text-blue-500/g, 'hover:text-[#00FF88]'],
  [/hover:text-blue-600/g, 'hover:text-[#00cc6e]'],
  [/hover:text-blue-900/g, 'hover:text-green-900'],

  // ── Hover borders ──────────────────────────────────────────────
  [/hover:border-blue-300/g,  'hover:border-green-300'],
  [/hover:border-blue-400/g,  'hover:border-green-400'],
  [/hover:border-blue-500/g,  'hover:border-[#00FF88]'],

  // ── Focus rings ────────────────────────────────────────────────
  [/focus:ring-blue-500\/50/g, 'focus:ring-[#00FF88]/50'],
  [/focus:ring-blue-500/g,     'focus:ring-[#00FF88]'],
  [/focus:ring-blue-100/g,     'focus:ring-green-100'],
  [/focus:border-blue-500/g,   'focus:border-[#00FF88]'],

  // ── Ring ───────────────────────────────────────────────────────
  [/ring-blue-100/g,      'ring-green-100'],
  [/ring-blue-900\/50/g,  'ring-green-900/50'],

  // ── Shadow ─────────────────────────────────────────────────────
  [/shadow-blue-500\/5/g,  'shadow-green-500/5'],
  [/shadow-blue-500\/20/g, 'shadow-green-500/20'],
  [/shadow-blue-500\/25/g, 'shadow-green-500/25'],

  // ── Dark: bg ───────────────────────────────────────────────────
  [/dark:bg-blue-800\/40/g,   'dark:bg-green-800/40'],
  [/dark:bg-blue-900\/15/g,   'dark:bg-green-900/15'],
  [/dark:bg-blue-900\/20/g,   'dark:bg-green-900/20'],
  [/dark:bg-blue-900\/30/g,   'dark:bg-green-900/30'],
  [/dark:bg-blue-900\/40/g,   'dark:bg-green-900/40'],
  [/dark:bg-blue-900\/50/g,   'dark:bg-green-900/50'],
  [/dark:bg-blue-950\/20/g,   'dark:bg-green-950/20'],
  [/dark:bg-blue-950\/30/g,   'dark:bg-green-950/30'],

  // ── Dark: text ─────────────────────────────────────────────────
  [/dark:text-blue-100/g,  'dark:text-green-100'],
  [/dark:text-blue-300/g,  'dark:text-green-300'],
  [/dark:text-blue-400/g,  'dark:text-green-400'],

  // ── Dark: border ───────────────────────────────────────────────
  [/dark:border-blue-400/g,  'dark:border-green-400'],
  [/dark:border-blue-700/g,  'dark:border-green-700'],
  [/dark:border-blue-800/g,  'dark:border-green-800'],

  // ── Dark: hover ────────────────────────────────────────────────
  [/dark:hover:bg-blue-900\/20/g,  'dark:hover:bg-green-900/20'],
  [/dark:hover:bg-blue-950\/30/g,  'dark:hover:bg-green-950/30'],
  [/dark:hover:border-blue-700/g,  'dark:hover:border-green-700'],
  [/dark:hover:text-blue-400/g,    'dark:hover:text-green-400'],
  [/dark:hover:text-blue-100/g,    'dark:hover:text-green-100'],
]

// Only fix the setup wizard files
const TARGET_DIR = path.join(__dirname, '..', 'src', 'app', 'c', '[slug]', 'setup')

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const e of entries) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) { walk(full); continue }
    if (!e.name.endsWith('.tsx') && !e.name.endsWith('.ts')) continue
    let src = fs.readFileSync(full, 'utf8')
    const original = src
    for (const [pattern, replacement] of replacements) {
      src = src.replace(pattern, replacement)
    }
    if (src !== original) {
      fs.writeFileSync(full, src, 'utf8')
      console.log('Fixed:', path.relative(process.cwd(), full))
    }
  }
}

walk(TARGET_DIR)
console.log('Done.')
