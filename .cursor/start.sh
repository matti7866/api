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

echo "==> Startup complete"
