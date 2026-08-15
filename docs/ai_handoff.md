# AI Handoff - Orbis

## Estado atual

M01-M20 estão concluídas. M21 foi iniciada e está em checkpoint parcial por limite de uso. **M21 não está concluída nem aprovada.** O estado persistente, arquivos e próximos comandos estão em [`milestones/M21.md`](milestones/M21.md).

M01-M20 não significam que todos os módulos administrativos possuem UI. Endpoint, client, fixture ou teste não equivale a tela. As rotas frontend reais são `/login`, `/`, `/kanban`, `/timeline`, `/timeline/monthly`, `/timeline/yearly`, `/reports` e `/chat`. Não existe painel administrativo formal.

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

## Superfícies pré-M21 e trabalho parcial

- Antes de M21 não existia painel administrativo formal. O worktree agora contém uma implementação inicial em `/admin/*`, ainda não aprovada.
- Backend parcial: memberships administrativas, criação atômica de membro, permissões explícitas, capacity settings e edição de Release DRAFT.
- Frontend parcial: Companies, Users/Memberships, Requisitions, Systems/Versions, Releases e Audit em `app/src/features/admin/`.
- Capabilities foram expandidas para o catálogo real do backend.
- Nenhuma migration foi criada; Attachments e o modelo `artifactLocation` foram preservados.
- Ativação/inativação, MASTER, reset/invite de senha e status de Requisition continuam não implementados.
- Não existe fluxo oficial de criação ou promoção MASTER. `POST /users`, `POST /companies` e `POST /memberships` são API-only; não inventar seed, senha ou procedimento de promoção.

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
| M21 | Em andamento; checkpoint parcial, não concluída e não aprovada |

Os detalhes históricos das decisões e validações permanecem nos arquivos das milestones. Quando um registro histórico mencionar uma pendência que foi resolvida depois, a resolução posterior é a fonte do estado atual.

## Checkpoint M21

Testes executados antes da parada: backend focado 101 passed e 5 skips PostgreSQL; API typecheck/lint aprovados. App 664 passed, coverage acima dos thresholds, typecheck/lint/build aprovados. Não foram executados/aprovados API global, API coverage, PostgreSQL real sem skips, Playwright administrativo ou Playwright global.

O worktree está sujo e preservado, sem commit. Não há processos temporários de API/Vite/Vitest/Playwright. O container preexistente `orbis-postgres-test` permanece ativo na porta 5433. `commands/` não foi alterado.

## Próximo passo recomendado

Retomar pela revisão e execução dos testes backend com PostgreSQL real serial, começando pelos arquivos e comandos registrados em [`milestones/M21.md`](milestones/M21.md). Não continuar frontend ou Playwright antes de resolver skips e aprovar essa fase.
