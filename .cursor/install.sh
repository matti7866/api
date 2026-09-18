#!/usr/bin/env bash
#
# Idempotent environment bootstrap for the SN Travels project.
# Runs after the repository is checked out. Installs system tooling, PHP and
# Node dependencies, generates local config, and seeds the dev database.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "==> Installing system packages (php, mariadb, composer)"
if ! command -v php >/dev/null 2>&1 || ! command -v mariadbd >/dev/null 2>&1; then
  export DEBIAN_FRONTEND=noninteractive
  sudo apt-get update -y
  sudo apt-get install -y \
    php-cli php-mysql php-mbstring php-gd php-curl php-xml php-zip php-bcmath php-intl \
    mariadb-server unzip curl
fi

if ! command -v composer >/dev/null 2>&1; then
  echo "==> Installing Composer"
  curl -sS https://getcomposer.org/installer -o /tmp/composer-setup.php
  sudo php /tmp/composer-setup.php --install-dir=/usr/local/bin --filename=composer
  rm -f /tmp/composer-setup.php
fi

echo "==> Installing PHP dependencies (composer)"
composer install --no-interaction --no-progress

echo "==> Installing frontend dependencies (npm)"
( cd react-frontend && npm ci )

# Generate local config from committed templates (kept out of git).
echo "==> Generating local config"
"$REPO_ROOT/.cursor/write-config.sh"

echo "==> Bootstrapping database"
"$REPO_ROOT/.cursor/start-db.sh"
php "$REPO_ROOT/.cursor/db-bootstrap.php"

echo "==> Install complete"
