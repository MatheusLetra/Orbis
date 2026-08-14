# AI Handoff - Orbis

## Estado atual

M01-M20 estão concluídas. M21 não foi iniciada e permanece bloqueada até solicitação formal. A consolidação documental pós-M20 não altera comportamento funcional.

Validação registrada: API 1027/1027 testes, app 632/632; coverage API 96,59% statements, 90,05% branches, 97,17% functions, 97,71% lines; app 95,72%, 90,54%, 96,33%, 96,85%. PostgreSQL real serial, Playwright M20 1/1, Playwright global 57/57, typecheck, lint, builds, Docker builds, restore isolado e diff-check aprovados.

## Contratos que não podem regredir

- Company é tenant; User é identidade global; Membership vincula usuário e empresa.
- O backend resolve permissões por membership e valida `companyId` em toda operação tenant-owned.
- Tasks usam `TODO`, `IN_PROGRESS`, `PAUSED` e `DONE`; `DONE` é terminal. Histórico é append-only.
- Kanban tem quatro colunas fixas; não há Board/Column persistidos, reorder ou endpoint `/kanban`.
- Pausar, retomar e concluir usam UoW e lock `FOR UPDATE`; `PAUSED -> DONE` fecha a pausa.
- TimeEntries são manuais, 1-1440 minutos, e não substituem estimativa nem alteram status.
- Capacity é uma simulação explícita, sem persistência automática de planejamento.
- Attachments permanecem em PostgreSQL: metadados em `attachments` e conteúdo FILE em `attachment_blobs.data BYTEA`; listas não carregam BYTEA.
- Releases persistem apenas `artifactLocation` textual. Não existe armazenamento físico, variável de caminho, filesystem, S3/provider ou download binário.
- Chat e Notifications usam HTTP explícito e persistência; não há WebSocket, polling, EventSource, Redis, push ou e-mail.
- Audit é append-only e tenant-aware; metadata não contém segredos, cookies, tokens, binários ou payloads integrais.

## Execução oficial

API: `cd API && cp .env.example .env && npm install && npm run db:migrate && npm run dev`.

App: `cd app && cp .env.example .env && npm install && npm run dev`.

Banco alternativo: construir `API/Dockerfile.postgres` e executar o container PostgreSQL; ou usar PostgreSQL puro e depois `cd API && npm run db:migrate`. Não existe reset oficial.

Health: `/health`, `/health/live`, `/health/ready`. Scalar: `/reference`, `/reference/openapi.json`, `/reference/openapi.yaml`.

Testes: `npm test`, `npm run test:coverage`, `npm run typecheck`, `npm run lint` e `npm run build` nos diretórios API/app. Auditoria browser na raiz usa os scripts `audit:*` do `package.json`; execução é serial e produz `artifacts/browser-audit/`. Backup/restore está em `docs/operations/M20.md` e deve usar banco isolado.

## Usuário MASTER

Não há seed, script, endpoint MASTER ou credencial padrão. `POST /users` cria identidade; após login, `POST /companies` cria empresa e membership GESTOR. `ADMINISTRADOR` é um preset de permissões, não um fluxo de bootstrap MASTER. Não inventar senha, seed ou procedimento de produção. Para testes, usar fixtures/helpers efêmeros existentes; um bootstrap auditável separado é trabalho futuro.

## Milestones

| Milestone | Estado |
|---|---|
| M01-M10 | Concluídas |
| M11 | Concluída, incluindo Kanban, Tasks e Attachments no detalhe |
| M12 | Concluída, incluindo pausas e TimeEntries |
| M13 | Concluída, incluindo simulação de Capacity |
| M14 | Concluída, timeline semanal |
| M15 | Concluída, timelines mensal e anual |
| M16 | Concluída, Notifications in-app |
| M17 | Concluída, Chat direto HTTP |
| M18 | Concluída, Reports e CSV |
| M19 | Concluída, Audit |
| M20 | Concluída, hardening, observabilidade, deploy e backup/restore |
| M21 | Não iniciada; bloqueada até solicitação formal |

Os detalhes históricos das decisões e validações permanecem nos arquivos das milestones. Quando um registro histórico mencionar uma pendência que foi resolvida depois, a resolução posterior é a fonte do estado atual.

## Próximo passo recomendado

Nenhuma implementação funcional deve começar nesta consolidação. O próximo passo é uma solicitação formal para M21, precedida de nova auditoria documental e de confirmação explícita do escopo. Preservar Attachments BYTEA, Releases por `artifactLocation` e a regra de auditoria automatizada.
