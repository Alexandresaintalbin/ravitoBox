import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    return entry.name.endsWith('.ts') || entry.name.endsWith('.vue') ? [path] : []
  })
}

describe('secrets côté navigateur', () => {
  it('n’expose jamais la clé service role', () => {
    const source = sourceFiles(join(root, 'src')).map((file) => readFileSync(file, 'utf8')).join('\n')
    expect(source).not.toMatch(/SERVICE_ROLE/)
    expect(source).not.toMatch(/service_role/)
    expect(source).not.toMatch(/VITE_[A-Z0-9_]*SERVICE/)
  })
})

describe('RLS dans les migrations', () => {
  it('active le RLS sur chaque table du schéma public', () => {
    const directory = join(root, 'supabase/migrations')
    const sql = readdirSync(directory)
      .filter((name) => name.endsWith('.sql'))
      .map((name) => readFileSync(join(directory, name), 'utf8'))
      .join('\n')
    const tables = [...sql.matchAll(/create table(?: if not exists)? public\.([a-z_]+)/gi)].map((match) => match[1])
    expect(tables.length).toBeGreaterThan(0)
    for (const table of tables) {
      expect(sql, table).toMatch(new RegExp(`alter table public\\.${table} enable row level security`, 'i'))
    }
  })
})
