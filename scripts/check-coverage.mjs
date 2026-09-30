import { readFileSync } from 'node:fs'

const summary = JSON.parse(readFileSync(new URL('../coverage/coverage-summary.json', import.meta.url), 'utf8'))
const rules = [
  { label: 'moteur', test: (file) => file.includes('/src/engine/'), lines: 100, branches: 100 },
  { label: 'logique métier', test: (file) => /\/src\/(schemas|stores|composables|lib)\//.test(file), lines: 90, branches: 90 },
]

const failures = []
for (const [file, metrics] of Object.entries(summary)) {
  if (file === 'total') continue
  for (const rule of rules) {
    if (!rule.test(file)) continue
    if (metrics.lines.pct < rule.lines || metrics.branches.pct < rule.branches) {
      failures.push(`${file} (${rule.label}) : lignes ${metrics.lines.pct}% , branches ${metrics.branches.pct}%`)
    }
  }
}

const total = summary.total
if (total.lines.pct < 80 || total.branches.pct < 80) {
  failures.push(`global : lignes ${total.lines.pct}% , branches ${total.branches.pct}%`)
}

if (failures.length > 0) {
  console.error('Couverture insuffisante :')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(
  `Couverture OK — global ${total.lines.pct}% lignes / ${total.branches.pct}% branches.`,
)
