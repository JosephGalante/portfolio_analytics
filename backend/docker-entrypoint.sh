#!/bin/sh
set -eu

should_run_migrations="${RUN_DB_MIGRATIONS_ON_START:-true}"
command_name="${1:-}"

case "$should_run_migrations" in
  1|true|TRUE|True|yes|YES|Yes)
    if [ "$command_name" != "alembic" ]; then
      echo "Running Alembic migrations before startup..."
      alembic upgrade head
    fi
    ;;
esac

exec "$@"
