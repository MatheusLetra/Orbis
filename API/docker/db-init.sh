#!/bin/sh
set -eu

MIGRATIONS_DIR="/migrations"
JOURNAL="$MIGRATIONS_DIR/meta/_journal.json"
TMP_JOURNAL="/tmp/orbis-migrations.tsv"

if [ ! -f "$JOURNAL" ]; then
  echo "Nenhuma migration encontrada em $MIGRATIONS_DIR. Nada a aplicar."
  exit 0
fi

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-'EOSQL'
CREATE SCHEMA IF NOT EXISTS drizzle;
CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
  id SERIAL PRIMARY KEY,
  hash text NOT NULL,
  created_at bigint
);
EOSQL

jq -r '.entries | sort_by(.idx)[] | [.idx, .tag, .when] | @tsv' "$JOURNAL" > "$TMP_JOURNAL"

while read -r idx tag when; do
  file="$MIGRATIONS_DIR/$tag.sql"
  if [ ! -f "$file" ]; then
    echo "Migration SQL não encontrado: $file"
    exit 1
  fi
  hash=$(sha256sum "$file" | cut -d' ' -f1)
  recorded=$(psql -tA --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
    -c "SELECT hash FROM drizzle.__drizzle_migrations WHERE created_at = $when LIMIT 1;" | tr -d ' \r\n')
  if [ -n "$recorded" ] && [ "$recorded" != "$hash" ]; then
    echo "Hash divergente para migration $tag"
    exit 1
  fi
  last=$(psql -tA --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
    -c "SELECT COALESCE(MAX(created_at), 0) FROM drizzle.__drizzle_migrations;" | tr -d ' \r\n')

  if [ "$when" -le "$last" ]; then
    continue
  fi

  echo "Aplicando migration $tag..."
  sed 's/--> statement-breakpoint//g' "$file" | psql -v ON_ERROR_STOP=1 \
    --username "$POSTGRES_USER" --dbname "$POSTGRES_DB"

  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
    -c "INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ('$hash', $when);"

  echo "Migration $tag aplicada e registrada no journal."
done < "$TMP_JOURNAL"

rm -f "$TMP_JOURNAL"
echo "Banco do Orbis inicializado com sucesso."
