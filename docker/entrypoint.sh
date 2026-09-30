#!/bin/sh
set -eu

if [ -z "${SUPABASE_URL:-}" ] || [ -z "${SUPABASE_ANON_KEY:-}" ]; then
  echo "SUPABASE_URL et SUPABASE_ANON_KEY sont requis." >&2
  exit 1
fi

escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

cat > /usr/share/nginx/html/config.js <<EOF
window.__RAVITOBOX_CONFIG__ = {
  supabaseUrl: "$(escape "$SUPABASE_URL")",
  supabaseAnonKey: "$(escape "$SUPABASE_ANON_KEY")"
};
EOF

exec nginx -g 'daemon off;'
