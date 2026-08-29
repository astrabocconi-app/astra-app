#!/usr/bin/env bash
# Copy the service credentials apps/web needs from the local .env into Vercel
# production.
#
# These were never set in production, so the deployed app silently fell back to
# "no provider": OTP emails were logged to the server console instead of being
# sent, and Ask ASTRA / Materials had no upstream to call.
#
# Run from the repo root:   bash scripts/sync-prod-env.sh
# Re-runnable: existing variables are replaced.

set -uo pipefail

ENV_FILE="apps/web/.env"
SCOPE="mfmatozzas-projects"
PROJECT="astra-app"
TARGET="production"

KEYS=(
  SMTP_HOST SMTP_PORT SMTP_SECURE SMTP_USER SMTP_PASS EMAIL_FROM
  OPENAI_API_KEY RAG_MIN_SIMILARITY
  SUPABASE_URL SUPABASE_SECRET_KEY
  RAG_DATABASE_URL RAG_DIRECT_URL
)

if [ ! -f "$ENV_FILE" ]; then
  echo "Can't find $ENV_FILE — run this from the repo root." >&2
  exit 1
fi

tmp=$(mktemp)
trap 'rm -f "$tmp"' EXIT

for key in "${KEYS[@]}"; do
  value=$(grep "^${key}=" "$ENV_FILE" | head -1 | cut -d= -f2- | sed 's/^"//; s/"$//')

  if [ -z "$value" ]; then
    printf '  %-22s skipped (not set locally)\n' "$key"
    continue
  fi
  if printf '%s' "$value" | grep -qi 'placeholder\|xxxx'; then
    printf '  %-22s skipped (placeholder)\n' "$key"
    continue
  fi

  # Replace any existing value so the script is safe to re-run.
  npx vercel env rm "$key" "$TARGET" --scope "$SCOPE" --project "$PROJECT" --yes >/dev/null 2>&1

  printf '%s' "$value" > "$tmp"
  if npx vercel env add "$key" "$TARGET" --scope "$SCOPE" --project "$PROJECT" < "$tmp" >/dev/null 2>&1; then
    printf '  %-22s set (%d chars)\n' "$key" "${#value}"
  else
    printf '  %-22s FAILED\n' "$key"
  fi
done

echo
echo "Done. Env changes only reach the running app on the next deploy:"
echo "  npx vercel redeploy \$(npx vercel ls astra-app --scope $SCOPE --prod 2>/dev/null | grep -oE 'https://astra-[a-z0-9]+-mfmatozzas-projects\.vercel\.app' | head -1) --target production --scope $SCOPE"
