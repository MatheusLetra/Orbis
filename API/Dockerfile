# Imagem do banco de dados do Orbis (PostgreSQL com schema pronto).
# Na primeira execução com um volume vazio, cria o banco e aplica as migrations.
FROM postgres:17-alpine

ENV POSTGRES_USER=postgres
ENV POSTGRES_PASSWORD=postgres
ENV POSTGRES_DB=orbis

RUN apk add --no-cache jq

COPY src/infrastructure/database/migrations /migrations
COPY docker/db-init.sh /docker-entrypoint-initdb.d/01-db-init.sh
RUN chmod +x /docker-entrypoint-initdb.d/01-db-init.sh

HEALTHCHECK --interval=5s --timeout=3s --start-period=5s --retries=12 \
  CMD pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"
