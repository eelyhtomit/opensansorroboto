#!/usr/bin/env bash
# deploy.sh — Build, push DB migrations, and deploy to Cloudflare Pages
# Reads all credentials from .env in the project root.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# ── Load .env ────────────────────────────────────────────────────────────────
if [[ ! -f "$ROOT_DIR/.env" ]]; then
  echo "❌  .env not found at $ROOT_DIR/.env" >&2
  exit 1
fi
set -a
# shellcheck source=/dev/null
source "$ROOT_DIR/.env"
set +a

: "${SUPABASE_ACCESS_TOKEN:?SUPABASE_ACCESS_TOKEN is not set in .env}"
: "${SUPABASE_PROJECT_REF:?SUPABASE_PROJECT_REF is not set in .env}"

# ── 1. Build ─────────────────────────────────────────────────────────────────
echo ""
echo "🔨  Building SvelteKit for Cloudflare Pages..."
cd "$ROOT_DIR"
npm run build

# ── 2. DB migrations via Supabase Management API ─────────────────────────────
echo ""
echo "🗄️   Pushing DB migrations to Supabase project: $SUPABASE_PROJECT_REF"

MIGRATIONS_DIR="$ROOT_DIR/supabase/migrations"
if [[ ! -d "$MIGRATIONS_DIR" ]]; then
  echo "⚠️   No migrations directory found, skipping DB push."
else
  MIGRATION_FILES=($(ls -1 "$MIGRATIONS_DIR"/*.sql 2>/dev/null | sort))
  if [[ ${#MIGRATION_FILES[@]} -eq 0 ]]; then
    echo "⚠️   No .sql migration files found, skipping DB push."
  else
    for f in "${MIGRATION_FILES[@]}"; do
      echo "  → Applying: $(basename "$f")"
      SQL=$(cat "$f")
      RESPONSE=$(curl -s -X POST \
        "https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/database/query" \
        -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
        -H "Content-Type: application/json" \
        -d "{\"query\": $(printf '%s' "$SQL" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')}")
      # Check for error key in response
      if echo "$RESPONSE" | python3 -c "import json,sys; d=json.load(sys.stdin); sys.exit(0 if isinstance(d, list) else 1)" 2>/dev/null; then
        echo "     ✅  OK"
      else
        echo "     ⚠️   Response: $RESPONSE"
      fi
    done
    echo "✅  All migrations applied."
  fi
fi

# ── 3. Deploy to Cloudflare Pages ────────────────────────────────────────────
echo ""
echo "🚀  Deploying to Cloudflare Pages (project: opensansorroboto, branch: main)..."
cd "$ROOT_DIR"
wrangler pages deploy .svelte-kit/cloudflare \
  --project-name opensansorroboto \
  --branch main \
  --commit-dirty=true

echo ""
echo "✅  Deploy complete!"
echo "    Pages URL : https://opensansorroboto.pages.dev"
echo "    Custom    : https://opensansorroboto.com (DNS propagation may take a few minutes)"
