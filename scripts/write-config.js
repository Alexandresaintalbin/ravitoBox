import { existsSync, readFileSync, writeFileSync } from 'node:fs'

if (existsSync('.env')) {
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (match && process.env[match[1]] == null) process.env[match[1]] = match[2]
  }
}

const config = {
  supabaseUrl: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '',
}

writeFileSync('public/config.js', `window.__RAVITOBOX_CONFIG__ = ${JSON.stringify(config, null, 2)};\n`)
