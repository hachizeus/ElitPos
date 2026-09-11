const fs = require('fs'), path = require('path')
let n = 0
function w(d) {
  fs.readdirSync(d, { withFileTypes: true }).forEach(e => {
    const f = path.join(d, e.name)
    if (e.isDirectory()) { w(f); return }
    if (!f.endsWith('.tsx')) return
    fs.readFileSync(f, 'utf8').split('\n').forEach((l, i) => {
      if (/blue-/.test(l)) { n++; console.log(f + ':' + (i+1) + ': ' + l.trim()) }
    })
  })
}
w('src/app/c/[slug]/setup')
console.log(n === 0 ? 'CLEAN' : 'REMAINING: ' + n)
