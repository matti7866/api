#!/usr/bin/env bash
#
# Generate local (git-ignored) config files from committed templates.
# Idempotent: only writes files that are missing.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Root connection.php required by the whole PHP API (defines $pdo).
if [ ! -f "$REPO_ROOT/connection.php" ]; then
  cp "$REPO_ROOT/.cursor/connection.template.php" "$REPO_ROOT/connection.php"
  echo "  created connection.php"
fi

# Frontend dev environment pointing at the local PHP API.
if [ ! -f "$REPO_ROOT/react-frontend/.env" ]; then
  cat > "$REPO_ROOT/react-frontend/.env" <<'EOF'
VITE_API_BASE_URL=http://localhost:8000/api
VITE_BASE_URL=http://localhost:8000
VITE_APP_NAME=Selab Nadiry Travel & Tourism
VITE_APP_VERSION=2.0.0
EOF
  echo "  created react-frontend/.env"
fi
