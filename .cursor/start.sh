#!/usr/bin/env bash
#
# Per-boot startup: ensure config exists, start the database, and seed it.
# The PHP API server and Vite dev server run as separate `terminals`.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# Regenerate git-ignored config (the checkout does not include it).
"$REPO_ROOT/.cursor/write-config.sh"

# Bring up MariaDB and make sure the schema + demo user exist.
"$REPO_ROOT/.cursor/start-db.sh"
php "$REPO_ROOT/.cursor/db-bootstrap.php"

# Start the PHP API server (serves /api/... from the repo root) if not already up.
if ! ss -ltn 2>/dev/null | grep -q ':8000'; then
  ( cd "$REPO_ROOT" && setsid php -S 0.0.0.0:8000 -t "$REPO_ROOT" >/tmp/php-api.log 2>&1 & )
  echo "  PHP API server starting on :8000 (logs: /tmp/php-api.log)"
else
  echo "  PHP API server already running on :8000"
fi

# Start the Vite dev server (React frontend) if not already up.
if ! ss -ltn 2>/dev/null | grep -q ':5174'; then
  ( cd "$REPO_ROOT/react-frontend" && setsid npm run dev >/tmp/vite.log 2>&1 & )
  echo "  Vite dev server starting on :5174 (logs: /tmp/vite.log)"
else
  echo "  Vite dev server already running on :5174"
fi

echo "==> Startup complete"
