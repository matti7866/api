#!/usr/bin/env bash
#
# Start MariaDB and ensure a passwordless local root account over TCP.
# Idempotent and safe to run on every boot.
set -euo pipefail

# Ensure the data directory is initialised (fresh image / new pod).
if [ ! -d /var/lib/mysql/mysql ]; then
  sudo mariadb-install-db --user=mysql --datadir=/var/lib/mysql >/dev/null 2>&1 || true
fi

# Start the server if it is not already accepting connections.
if ! sudo mariadb -e "SELECT 1" >/dev/null 2>&1; then
  sudo service mariadb start 2>/dev/null || {
    sudo mkdir -p /run/mysqld
    sudo chown mysql:mysql /run/mysqld
    sudo -u mysql /usr/sbin/mariadbd --datadir=/var/lib/mysql >/tmp/mariadbd.log 2>&1 &
  }
fi

# Wait for readiness.
for i in $(seq 1 30); do
  if sudo mariadb -e "SELECT 1" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

# Configure a passwordless root usable over TCP (matches connection defaults).
sudo mariadb <<'SQL'
CREATE DATABASE IF NOT EXISTS sntravels_prod CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'root'@'127.0.0.1' IDENTIFIED VIA mysql_native_password USING '';
ALTER USER 'root'@'localhost' IDENTIFIED VIA mysql_native_password USING '';
ALTER USER 'root'@'127.0.0.1' IDENTIFIED VIA mysql_native_password USING '';
GRANT ALL PRIVILEGES ON *.* TO 'root'@'127.0.0.1' WITH GRANT OPTION;
GRANT ALL PRIVILEGES ON *.* TO 'root'@'localhost' WITH GRANT OPTION;
FLUSH PRIVILEGES;
SQL

echo "  MariaDB ready"
