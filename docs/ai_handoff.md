# AI Handoff - Orbis

## Estado atual

M01-M21 estão concluídas. M21 foi aprovada após todos os gates obrigatórios. O próximo trabalho depende da definição formal da M22.

M21 adicionou painel administrativo em `/admin/*`, com gates por capability e tenant ativo. Endpoint, client, fixture ou teste não equivale a operação aprovada sem os gates correspondentes.

Validação registrada de M21: API 1040/1040 testes, app 665/665; coverage API 96,61% statements, 90,01% branches, 97,24% functions, 97,73% lines; app 95,70%, 90,02%, 96,13%, 96,71%. PostgreSQL real serial sem skips, Playwright M21 3/3, Playwright global 60/60, typecheck, lint, builds, `tsc` raiz e diff-check aprovados.

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

## Superfícies M21

- O painel administrativo possui Companies, Users/Memberships, Requisitions, Systems/Versions, Releases e Audit em `/admin/*`.
- Backend parcial: memberships administrativas, criação atômica de membro, permissões explícitas, capacity settings e edição de Release DRAFT.
- Frontend: clients, parsers runtime, query keys tenant-aware, queries/mutations, gates, estados, dialogs acessíveis e auditoria browser em `app/src/features/admin/`.
- Capabilities foram expandidas para o catálogo real do backend.
- Nenhuma migration foi criada; Attachments e o modelo `artifactLocation` foram preservados.
- Ativação/inativação, MASTER, reset/invite de senha, Attachments administrativos e status administrativo de Requisition continuam não implementados/API-only.
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
| M21 | Concluída e aprovada |

Os detalhes históricos das decisões e validações permanecem nos arquivos das milestones. Quando um registro histórico mencionar uma pendência que foi resolvida depois, a resolução posterior é a fonte do estado atual.

## Validação M21

API: 1040/1040 testes, PostgreSQL real serial sem skips; coverage 96,61% statements, 90,01% branches, 97,24% functions, 97,73% lines. App: 665/665; coverage 95,70%, 90,02%, 96,13%, 96,71%. Typecheck, lint e builds de API/app, `tsc` raiz e `git diff --check` aprovados.

Playwright M21: 3/3. Playwright global: 60/60. Artifacts foram gerados em `artifacts/browser-audit/`. Nenhuma migration M21 foi criada ou aplicada; Attachments e Releases/storage permaneceram inalterados.

O worktree está sujo e preservado, sem commit. Não há processos temporários de API/Vite/Vitest/Playwright. O container preexistente `orbis-postgres-test` permanece ativo na porta 5433. `commands/` não foi alterado.

## Backlog futuro pós-M21

M22 ainda não foi definida, não foi iniciada e não possui número, escopo ou critérios de aceitação aprovados. Os itens abaixo são backlog futuro, não funcionalidades implementadas e não bloqueiam o estado utilizável atual.

### Notifications Lifecycle

- `TASK_DUE_SOON` e `TASK_OVERDUE`;
- regras de destinatários;
- timezone e calendário;
- scheduler;
- idempotência e deduplicação;
- concorrência e locks;
- retenção, expiração e limpeza;
- somente canal in-app inicialmente.

### Tempo real e canais

- WebSocket, SSE ou polling;
- reconexão e recuperação de mensagens;
- autorização de conexão;
- e-mail, push, templates e preferências de canais.

### Evolução do Chat

- integração `CHAT_MESSAGE` com Notifications;
- presença, menções e anexos;
- edição e remoção de mensagens;
- entrega em tempo real.

### Administração complementar

- ativação/inativação de Company, User e Membership;
- reset/convite de senha;
- bootstrap ou promoção MASTER;
- administração avançada de permissões.

### Operações

- retenção de Notifications, Audit e refresh tokens;
- expiração e limpeza;
- deduplicação avançada;
- filas/outbox e locks distribuídos;
- métricas e tracing adicionais.

Nenhum item deste backlog possui implementação, endpoint, migration, dependência ou tela aprovada. O runtime atual continua HTTP-only; PostgreSQL continua sendo a fonte da verdade; não há WebSocket, scheduler, e-mail, push, Redis ou storage externo. Releases usam somente `artifactLocation`; Attachments continuam em PostgreSQL BYTEA.

## Próximo passo recomendado

Definir formalmente uma futura milestone antes de implementar qualquer item acima. Não tratar o backlog como bloqueio do sistema atual e não criar fluxo MASTER, ativação/inativação, reset de senha, status administrativo de Requisition ou storage/download binário de Release sem contrato aprovado.
