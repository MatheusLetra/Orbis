# Manual do Desenvolvedor

## Visão geral

Orbis é um monólito modular multiempresa. `Company` é o tenant, `User` é identidade global, `Membership` liga usuário e empresa e `Actor` é o contexto autenticado com `userId`, `companyId` e permissões. Autorização é por permissões; cargo é atributo de membership e pode fornecer preset. Toda consulta tenant-owned valida a membership no backend.

Fonte de verdade, em ordem: código/testes executados; schema/migrations; OpenAPI/Scalar; configuração de execução; documentação atual; histórico.

## Tecnologias

Node.js 22 nas imagens (Node.js 20+ aceito localmente), TypeScript strict, Fastify 5, React 19, Vite, Drizzle ORM, PostgreSQL 17, Vitest, Playwright, Pino, Zod, jose, React Query, React Router, Tailwind, shadcn/ui, dnd-kit, Docker e esbuild. Redis, WebSocket e providers externos não estão implementados.

## Estrutura e arquitetura

`API/src/modules` contém auth, companies, users, memberships, permissions, systems, versions, releases, requisitions, tasks, capacity, timeline, notifications, chat, reports e audit. `API/src/infrastructure` contém banco, composição, HTTP e segurança. `app/src/features` contém auth, companies, members, capacity, kanban/tasks, attachments, timelines, reports, notifications e chat. `audit` contém scripts, fixtures e specs Playwright. `API/src/infrastructure/database/migrations` contém migrations. `API/Dockerfile`, `API/Dockerfile.postgres` e `app/Dockerfile` são os Dockerfiles reais.

Fluxo backend: HTTP/parser/schema -> use case -> domain -> repository port -> Drizzle/PostgreSQL. Operações multi-entidade usam Unit of Work e transação; transições de Task usam `FOR UPDATE`. Frontend usa clients centralizados, parsers runtime, React Query, query keys com tenant, `AbortSignal` e proteção de respostas stale. Não reproduza regras de domínio nos componentes.

## Contratos principais

- Task statuses: `TODO`, `IN_PROGRESS`, `PAUSED`, `DONE`; `DONE` é terminal. As transições aceitas são `TODO -> IN_PROGRESS`, `IN_PROGRESS -> PAUSED|DONE` e `PAUSED -> IN_PROGRESS|DONE`; `DONE -> outro status` e `IN_PROGRESS -> TODO` continuam decisões pendentes.
- Datas de Task (`startDate` e `plannedEndDate`) são datas de calendário. O banco usa PostgreSQL `date`; o HTTP aceita `YYYY-MM-DD` e adapta explicitamente a resposta para ISO à meia-noite UTC, sem converter a data no frontend. A criação rejeita formato inválido e intervalo invertido.
- Kanban: quatro colunas fixas, sem Board/Column persistidos ou reorder.
- Capacity: `dailyCapacity = developers * dailyHours`; previsão usa dias úteis e `Math.ceil` para avanço, com estimativa explícita; a simulação não persiste.
- TimeEntry: duração manual de 1 a 1440 minutos; separado de pausa e estimativa.
- Cursor: chat e audit usam cursores opacos; relatórios JSON são paginados e CSV tem teto de 10.000 Tasks.
- Readiness: `/health/ready` consulta banco e retorna 503 quando indisponível; liveness não depende do banco.

## Endpoints reais

Todos os endpoints abaixo são registrados pela composição atual e documentados no Scalar. Rotas de negócio exigem Bearer access token; rotas tenant-owned exigem membership e permissões aplicáveis.

```text
POST /users
POST /auth/login
POST /auth/refresh
POST /auth/logout
GET  /health
GET  /health/live
GET  /health/ready
GET  /reference
GET  /reference/openapi.json
GET  /reference/openapi.yaml

POST /companies
GET  /companies
GET  /companies/:companyId
PATCH /companies/:companyId
GET  /companies/:companyId/capabilities
POST /memberships
GET  /memberships
GET  /companies/:companyId/members

POST /companies/:companyId/systems
GET  /companies/:companyId/systems
GET  /companies/:companyId/systems/:systemId
PATCH /companies/:companyId/systems/:systemId
DELETE /companies/:companyId/systems/:systemId
POST /companies/:companyId/systems/:systemId/versions
GET  /companies/:companyId/systems/:systemId/versions
GET  /companies/:companyId/versions/:versionId
PATCH /companies/:companyId/versions/:versionId
DELETE /companies/:companyId/versions/:versionId
POST /companies/:companyId/releases
GET  /companies/:companyId/releases
GET  /companies/:companyId/releases/:releaseId
POST /companies/:companyId/releases/:releaseId/publish
DELETE /companies/:companyId/releases/:releaseId

POST /companies/:companyId/requisitions
GET  /companies/:companyId/requisitions
GET  /companies/:companyId/requisitions/:requisitionId
PATCH /companies/:companyId/requisitions/:requisitionId
DELETE /companies/:companyId/requisitions/:requisitionId
POST /companies/:companyId/requisitions/:requisitionId/assignees
GET  /companies/:companyId/requisitions/:requisitionId/assignees
DELETE /companies/:companyId/requisitions/:requisitionId/assignees/:userId

POST /companies/:companyId/tasks
GET  /companies/:companyId/tasks
GET  /companies/:companyId/tasks/:taskId
PATCH /companies/:companyId/tasks/:taskId
PATCH /companies/:companyId/tasks/:taskId/status
GET  /companies/:companyId/tasks/:taskId/time-entries
POST /companies/:companyId/tasks/:taskId/time-entries

GET /companies/:companyId/requisitions/:requisitionId/attachments
POST /companies/:companyId/requisitions/:requisitionId/attachments/files
POST /companies/:companyId/requisitions/:requisitionId/attachments/links
GET /companies/:companyId/requisitions/:requisitionId/attachments/:attachmentId/file
DELETE /companies/:companyId/requisitions/:requisitionId/attachments/:attachmentId
GET /companies/:companyId/tasks/:taskId/attachments
POST /companies/:companyId/tasks/:taskId/attachments/files
POST /companies/:companyId/tasks/:taskId/attachments/links
GET /companies/:companyId/tasks/:taskId/attachments/:attachmentId/file
DELETE /companies/:companyId/tasks/:taskId/attachments/:attachmentId

GET /companies/:companyId/capacity
GET /companies/:companyId/timeline/weekly
GET /companies/:companyId/timeline/monthly
GET /companies/:companyId/timeline/yearly
GET /companies/:companyId/reports/tasks
GET /companies/:companyId/reports/tasks/export
GET /companies/:companyId/notifications
PATCH /companies/:companyId/notifications/:notificationId/read
GET /companies/:companyId/notification-preferences
PATCH /companies/:companyId/notification-preferences
GET /companies/:companyId/conversations
POST /companies/:companyId/conversations
GET /companies/:companyId/conversations/:conversationId/messages
POST /companies/:companyId/conversations/:conversationId/messages
PATCH /companies/:companyId/conversations/:conversationId/read
GET /companies/:companyId/audit
```

The API has no Release binary download route. M21 adds authenticated `/admin/*` routes for the administrative surfaces below; operations without a confirmed contract remain API/Scalar-only.

## Matriz Backend/Frontend

| Funcionalidade | Backend | Endpoint | Frontend | Rota | Permissão | Teste Playwright | Status |
|---|---|---|---|---|---|---|---|
| Companies: seleção/listagem | Sim | `GET /companies` | Sim | `/`, AppShell | Membership ativa | Responsividade/Capacity | Implementada no backend e frontend |
| Companies: criar/editar/timezone | Sim | `POST /companies`, `PATCH /companies/:companyId` | Parcial | `/admin/companies` (edição) | `company.update` | `m21.spec.ts` | Criação continua API-only |
| Companies: ativar/inativar | Não há operação HTTP confirmada | — | Não | — | — | Não | Não implementada |
| Capacity: simulação | Sim | `GET /companies/:companyId/capacity` | Sim | `/` | `capacity.read` | `capacity.spec.ts` | Implementada no backend e frontend |
| Capacity: configuração persistida | Sim | `GET/PATCH /companies/:companyId/capacity-settings` | Sim | `/admin/companies` | `capacity.read`, `company.update` | `m21.spec.ts` | Implementada |
| Users | `POST /users` | `POST /users` | Não | — | Público | Não | Implementada somente no backend |
| Users/Memberships administrativas | Sim | `GET/POST/PATCH /companies/:companyId/members*` | Sim | `/admin/users` | `users.read`, `users.manage`, `permissions.manage` | `m21.spec.ts` | Implementada |
| Requisitions: CRUD | Sim | CRUD em `/companies/:companyId/requisitions` | Sim | `/admin/requisitions` | `requisitions.read/create/update/delete` | `m21.spec.ts` | Implementada |
| Requisitions: leitura/filtros | Sim | `GET /companies/:companyId/requisitions` | Parcial | `/timeline/monthly`, `/timeline/yearly` | `requisitions.read` | Timelines | Implementada somente parcialmente |
| Requisitions: assignees | Sim | `.../assignees` | Sim | `/admin/requisitions` | `requisitions.read/update` | `m21.spec.ts` | Implementada |
| Tasks associadas a Requisition | Sim | `requisitionId` em Tasks | Sim | `/admin/requisitions` e `/kanban` | `tasks.create/update` | testes de Task/Kanban | Implementada; datas de calendário preservadas |
| Systems | Sim | CRUD `/companies/:companyId/systems` | Sim | `/admin/systems` | `systems.read/manage` | `m21.spec.ts` | Implementada |
| Versions | Sim | CRUD `/companies/:companyId/.../versions` | Sim | `/admin/versions` | `systems.read`, `versions.manage` | `m21.spec.ts` | Implementada |
| Releases | Sim | CRUD/publicação `/companies/:companyId/releases` | Sim | `/admin/releases` | `releases.read/manage` | `m21.spec.ts` | Metadados somente textuais |
| Release download | Não | Não existe | Não | — | — | Ausente | Não implementada |
| Audit | Sim | `GET /companies/:companyId/audit` | Sim | `/admin/audit` | `audit.read` | `m21.spec.ts` | Implementada |
| AppShell | — | — | Sim | Todas as rotas autenticadas | Sessão | Responsividade global | Implementada |

### Rotas frontend reais

`/login`, `/`, `/kanban`, `/timeline`, `/timeline/monthly`, `/timeline/yearly`, `/reports`, `/chat` e `/admin/*`. O AppShell fornece seleção de empresa ativa, Início/Voltar, navegação operacional, Chat, Notifications, tema e logout; o AdminLayout fornece breadcrumb, navegação e gates administrativos.

### Operações API-only

São API-only: criação de Company, criação de User, bootstrap/promoção MASTER, ativação/inativação, reset/invite de senha, transição administrativa de status de Requisition e Attachments de Requisition. As demais superfícies administrativas de M21 possuem UI em `/admin/*`.

### Permissões sem UI correspondente

Permissões existentes no backend: `company.read`, `company.update`, `users.read`, `users.manage`, `permissions.manage`, `systems.read`, `systems.manage`, `versions.manage`, `releases.read`, `releases.manage`, `requisitions.read`, `requisitions.create`, `requisitions.update`, `requisitions.delete`, `tasks.read`, `tasks.create`, `tasks.update`, `tasks.delete`, `kanban.manage`, `timeline.manage`, `capacity.read`, `hours.register`, `notifications.manage`, `chat.use` e `audit.read`.

As capabilities administrativas são usadas como gates em `/admin/*`: `company.read/update`, `users.read/manage`, `permissions.manage`, `systems.read/manage`, `versions.manage`, `releases.read/manage`, `requisitions.read/create/update/delete` e `audit.read`. As permissões operacionais de Tasks, Timelines, Capacity, Notifications e Chat têm uso nas telas específicas.

O contrato de capabilities exposto ao app cobre o catálogo real do backend e é validado por parser runtime; a ausência de capability efetiva oculta a navegação e bloqueia a tela.

### MASTER

Não existe fluxo oficial suportado de criação ou promoção MASTER. `POST /users` cria uma identidade; `POST /companies` cria empresa e membership conforme o contrato existente; `POST /memberships` associa usuários conforme autorização. Não há seed oficial, senha padrão, endpoint de promoção ou tela MASTER. Essa é uma lacuna futura, não um procedimento operacional.

### Próxima milestone

M21 está concluída. A próxima milestone deve ser formalmente definida antes de iniciar novas operações administrativas; não inventar MASTER, ativação/inativação, reset de senha ou storage de Release.

## Dicionário

Company: tenant. Membership: vínculo e permissões por empresa. Actor: contexto autenticado. Permission: autorização efetiva. Task: unidade executável. Requisition: demanda formal. TimeEntry: apontamento manual. PauseInterval: intervalo de pausa. Capacity: simulação de capacidade. Timeline: leitura temporal. Notification: aviso in-app persistido. Conversation/Message: chat direto persistido. Release: metadado publicado. `artifactLocation`: texto opaco da localização externa. Attachment: metadado de FILE/LINK. AuditLog: registro append-only. Tenant isolation: filtro e autorização por empresa. UoW: transação compartilhada. Stale response: resposta de request anterior descartada. Optimistic update: alteração visual antes da confirmação, usada somente com rollback explícito. Cursor: marcador opaco de paginação. Readiness/liveness: disponibilidade com/sem dependência do banco.

## Banco de dados

Schema em `API/src/infrastructure/database/schema.ts`; migrations `0000` a `0007`. Todos os IDs são UUID salvo onde indicado; timestamps têm timezone. Cascades abaixo são os FKs reais.

| Tabela | Finalidade e colunas principais | Chaves, índices, relações e cuidados |
|---|---|---|
| `companies` | tenant; `id`, `name`, `timezone`, `settings` JSONB, `daily_hours_per_developer` NUMERIC(4,2) nullable, `is_active`, timestamps | PK; children em cascade; configuração é tenant-scoped |
| `users` | identidade; `id`, `email`, `name`, `password_hash`, `is_active`, timestamps | PK; email unique; senha somente scrypt hash |
| `memberships` | vínculo; `id`, `company_id`, `user_id`, `position`, `permissions` JSONB, `is_active`, timestamps | PK, `(company_id,user_id)` unique, índice user; FKs company/user cascade |
| `systems` | catálogo; `id`, `company_id`, `name`, `description`, `is_active`, timestamps | PK, índice company; company cascade |
| `system_versions` | versões; `id`, `company_id`, `system_id`, `version`, `is_active`, timestamps | PK, unique `(system_id,version)`, índice company; system/company cascade |
| `releases` | metadados; `id`, `company_id`, `system_version_id`, `version_label`, `channel`, `status`, `artifact_name`, `artifact_location`, `published_at`, `created_by`, `created_at` | PK, índices company/version; version restrict; constraint publicada exige localização <=2048; sem blob |
| `requisition_number_counters` | contador de `number` por empresa; `company_id`, `last_number` | PK/FK company cascade; concorrência no repository |
| `requisitions` | demanda; `id`, tenant, `number`, título/descrição, prioridade/status, requester/responsible, system/version, `estimated_hours`, datas, entrega, timestamps | PK, unique `(company_id,number)`, índices status/planned; company cascade |
| `requisition_assignees` | responsáveis adicionais; `id`, company/requisition/user, createdAt | unique requisition/user; FKs cascade |
| `tasks` | trabalho; `id`, tenant, requisition nullable, título/descrição, prioridade/status, assignee, datas, completedAt, timestamps | PK, índices company/status e requisition; requisition set null, company cascade |
| `task_status_history` | histórico append-only; `id`, task, from/to status, changedBy, changedAt, metadata JSONB | PK, índice task; task cascade; não editar |
| `task_pause_intervals` | pausas; `id`, task, started/ended, durationSeconds | PK, índice task; task cascade; pode ter intervalo aberto |
| `time_entries` | horas; `id`, company/task/user, started/ended nullable, durationMinutes, description, createdAt | PK, índices company/task; company/task cascade; user restrict padrão |
| `attachments` | metadados FILE/LINK; owner requisition ou task, kind, nome/MIME/checksum/tamanho/url/título, creator, timestamps | PK, índices por owner; exactly-one-owner; FKs owner cascade; nunca incluir blob em listas |
| `attachment_blobs` | conteúdo de FILE; `attachment_id`, `data` BYTEA | PK/FK attachment cascade; único BYTEA do schema; carregar somente em download |
| `notification_preferences` | preferência in-app; user/company/event, enabled, timestamps | unique user/company/event; company/user cascade |
| `notifications` | avisos; company/user, eventId, type/title/body, readAt/data, createdAt | índices de listagem/não lidas; unique eventId parcial; tenant/user filter |
| `conversations` | conversa direta; company, type, directKey, timestamps | unique `(company_id,direct_key)`, type check `direct`; company cascade |
| `conversation_members` | participantes/leitura; conversation, user, lastReadAt, createdAt | unique conversation/user; conversation/user cascade |
| `messages` | mensagens; conversation, sender, body, createdAt, editedAt nullable | índice conversation/data/id; conversation cascade; contrato M17 não edita |
| `audit_logs` | auditoria; company nullable, actor nullable, action, entity type/id, metadata, createdAt | índices company/action; company cascade e actor set null; sem segredos |
| `refresh_tokens` | refresh hash e rotação; user, tokenHash, expires/revoked, replacedBy, createdAt | índices hash/user; user cascade; nunca guardar token puro |

### Tipos e nulabilidade

`?` significa nullable; campos sem `?` são `NOT NULL`. Defaults de enum/boolean/timestamp estão no schema.

```text
companies: id uuid PK, name text, timezone text, settings jsonb, daily_hours_per_developer numeric(4,2)?, is_active boolean, created_at timestamptz, updated_at timestamptz
users: id uuid PK, email text UNIQUE, name text, password_hash text, is_active boolean, created_at timestamptz, updated_at timestamptz
memberships: id uuid PK, company_id uuid FK, user_id uuid FK, position text?, permissions jsonb, is_active boolean, created_at timestamptz, updated_at timestamptz
systems: id uuid PK, company_id uuid FK, name text, description text?, is_active boolean, created_at timestamptz, updated_at timestamptz
system_versions: id uuid PK, company_id uuid FK, system_id uuid FK, version text, is_active boolean, created_at timestamptz, updated_at timestamptz
releases: id uuid PK, company_id uuid FK, system_version_id uuid FK, version_label text, channel enum, status enum, artifact_name text?, artifact_location text?, published_at timestamptz?, created_by uuid FK, created_at timestamptz
requisition_number_counters: company_id uuid PK/FK, last_number integer
requisitions: id uuid PK, company_id uuid FK, number integer, title text, description text?, priority enum, status enum, requester_id uuid FK, responsible_id uuid FK?, system_id uuid FK?, system_version_id uuid FK?, estimated_hours numeric(8,2)?, start_date date?, planned_delivery_date date?, delivered_at timestamptz?, created_at timestamptz, updated_at timestamptz
requisition_assignees: id uuid PK, company_id uuid FK, requisition_id uuid FK, user_id uuid FK, created_at timestamptz
tasks: id uuid PK, company_id uuid FK, requisition_id uuid FK?, title text, description text?, priority enum, status enum, assignee_id uuid FK?, start_date date?, planned_end_date date?, completed_at timestamptz?, created_at timestamptz, updated_at timestamptz
task_status_history: id uuid PK, task_id uuid FK, from_status enum?, to_status enum, changed_by uuid FK?, changed_at timestamptz, metadata jsonb?
task_pause_intervals: id uuid PK, task_id uuid FK, started_at timestamptz, ended_at timestamptz?, duration_seconds integer?
time_entries: id uuid PK, company_id uuid FK, task_id uuid FK, user_id uuid FK, started_at timestamptz?, ended_at timestamptz?, duration_minutes integer, description text?, created_at timestamptz
attachments: id uuid PK, company_id uuid FK, requisition_id uuid FK?, task_id uuid FK?, kind enum, file_name text?, mime_type text?, checksum text?, size_bytes bigint?, url text?, title text?, created_by uuid FK, created_at timestamptz
attachment_blobs: attachment_id uuid PK/FK, data bytea
notification_preferences: id uuid PK, user_id uuid FK, company_id uuid FK, event_type text, in_app_enabled boolean, created_at timestamptz, updated_at timestamptz
notifications: id uuid PK, company_id uuid FK, user_id uuid FK, event_id uuid?, type text, title text, body text?, read_at timestamptz?, data jsonb?, created_at timestamptz
conversations: id uuid PK, company_id uuid FK, type text, direct_key text, created_at timestamptz, updated_at timestamptz
conversation_members: id uuid PK, conversation_id uuid FK, user_id uuid FK, last_read_at timestamptz?, created_at timestamptz
messages: id uuid PK, conversation_id uuid FK, sender_id uuid FK, body text, created_at timestamptz, edited_at timestamptz?
audit_logs: id uuid PK, company_id uuid FK?, actor_user_id uuid FK?, action text, entity_type text?, entity_id text?, metadata jsonb?, created_at timestamptz
refresh_tokens: id uuid PK, user_id uuid FK, token_hash text, expires_at timestamptz, revoked_at timestamptz?, replaced_by_id uuid FK?, created_at timestamptz
```

Foreign keys de empresas e entidades tenant-owned usam `ON DELETE CASCADE` conforme a tabela anterior; referências de versões/releases, usuários e atores têm as exceções `RESTRICT`/`SET NULL` indicadas no schema. Não introduza tabelas ou colunas fora desse inventário.

Attachments usam PostgreSQL BYTEA e checksum/metadados; Releases usam somente texto `artifactLocation`, sem filesystem, S3, provider ou responsabilidade de download/integridade externa.

## Ambiente e banco

Variáveis reais da API: `NODE_ENV`, `PORT`, `HOST`, `DATABASE_URL`, `LOG_LEVEL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_TTL`, `JWT_REFRESH_TTL`, `JWT_ISSUER`, `JWT_AUDIENCE`, `FRONTEND_ORIGIN`. App: `VITE_API_URL`. Valores default de desenvolvimento existem no código, mas são inseguros para produção; não os documente como credenciais.

Banco novo: instale PostgreSQL, configure `API/.env`, crie o database e execute `cd API && npm install && npm run db:migrate`. Alternativamente, construa `API/Dockerfile.postgres`, que aplica as migrations no volume vazio. Repetição usa o journal/hashes. Não existe reset oficial. Banco de testes usa `TEST_DATABASE_URL` quando fornecido pelos testes/auditoria; banco de auditoria é temporário e isolado pelos scripts em `audit/scripts`.

## Usuário MASTER

Não há seed oficial, script, endpoint administrativo ou papel `MASTER`. `POST /users` é público e cria usuário com senha hasheada por scrypt. Após login, `POST /companies` cria empresa e membership `GESTOR`; `POST /memberships` vincula usuários, sujeito a `users.manage`. O preset `ADMINISTRADOR` resolve `ALL_PERMISSIONS`, mas a aplicação não oferece um bootstrap seguro automatizado para ele. Para desenvolvimento, use o fluxo público com senha local escolhida fora do Git e valide login; se for indispensável testar ADMINISTRADOR, prepare dados efêmeros via fixture/test helper existente, não altere produção nem grave senha pura. Um seed/bootstrap auditável separado é trabalho futuro.

## Rodar, testar e publicar

API: `npm run dev`, `npm run build`, `npm start`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:coverage`, `npm run db:generate`, `npm run db:migrate`, `npm run db:studio` em `API/`. App: `npm run dev`, `npm run build`, `npm run preview`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:coverage` em `app/`. Raiz: scripts `audit:*` do `package.json` para Playwright.

Verifique `curl /health`, `/health/live`, `/health/ready` e abra `/reference`. Docker: `docker build -f API/Dockerfile API` e `docker build -f app/Dockerfile app`. Encerre serviços com SIGTERM; a API baixa readiness, fecha Fastify e PostgreSQL.

Backup/restore real está em [`operations/M20.md`](operations/M20.md): `pg_dump --format=custom`, restore em banco isolado com `pg_restore`, validação de migrations, contagens, checksum de Attachments e smoke. O backup inclui BYTEA de Attachments e não inclui Releases.

## Como adicionar feature

1. Defina contrato e autorização no backend.
2. Crie entidade/value object e invariantes no domínio.
3. Crie repository port, use case, DTO/parser e mapper.
4. Implemente repository Drizzle, UoW quando houver múltiplas escritas e conecte o composition root.
5. Registre rota Fastify com schema OpenAPI/Scalar, validação, tenant isolation e logs seguros.
6. Crie testes unitários, aplicação, PostgreSQL, HTTP e regresão de permissão.
7. No app, crie contrato runtime, client, query keys, hook/mutation com AbortSignal e stale protection.
8. Crie UI com loading/error/empty, acessibilidade e mobile-first; integre cache sem optimistic update salvo estratégia de rollback.
9. Adicione testes Vitest e Playwright específico/global.
10. Atualize milestone, handoff, manuais e README; rode coverage, typecheck, lint, build e diff-check.

## Como corrigir bugs e checklist

Reproduza, classifique por frontend/backend/banco/infra, confira logs Pino e `X-Request-ID`, escreva teste de regressão, corrija na camada correta, verifique autorização/tenant/UoW/concorrência, rode testes focados e suites completas, coverage, Playwright e diff-check, então atualize handoff.

Checklist: contrato OpenAPI; parser; autorização; tenant isolation; UoW/rollback; concorrência; migration; logs sem segredo; loading/error/empty; acessibilidade/mobile; testes API/PostgreSQL/frontend/Playwright; coverage sem reduzir threshold; documentação.

## Auditoria

Antes de avançar milestone, execute a auditoria automatizada em browser real. O runner usa Chromium, PostgreSQL/fixtures isolados, `workers: 1` e artifacts. Falhas de ambiente devem ser distinguidas de falhas funcionais; auditorias não executadas continuam pendentes. M21 foi validada por `npm run audit:m21` e `npm run audit:browser`.
