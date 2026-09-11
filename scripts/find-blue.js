const fs = require('fs')
const path = require('path')

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const e of entries) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) { walk(full); continue }
    if (!e.name.endsWith('.tsx') && !e.name.endsWith('.ts')) continue
    const src = fs.readFileSync(full, 'utf8')
    const lines = src.split('\n')
    lines.forEach((line, i) => {
      if (/blue-/.test(line)) {
        console.log(`${path.relative(process.cwd(), full)}:${i+1}: ${line.trim()}`)
      }
    })
  }
}

walk(path.join(process.cwd(), 'src', 'app', 'c'))
walk(path.join(process.cwd(), 'src', 'components'))
