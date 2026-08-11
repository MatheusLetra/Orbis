# AI Handoff — Orbis

## Status atual

**M3 (Identidade: companies / users / memberships) concluído.**

- Módulos `companies`, `users` e `memberships` com entidades, use cases, repositórios Drizzle e rotas HTTP:
  - `POST /users` — cria usuário (identidade global) com hash de senha via `scryptPasswordHasher`.
  - `POST /companies` — cria empresa e a membership `GESTOR` do dono na mesma operação.
  - `GET /companies`, `GET /companies/:companyId`, `PATCH /companies/:companyId` — isolamento por membership (`MembershipAccessService`); usuário sem membership ativa recebe 403.
  - `POST /memberships`, `GET /memberships` — vínculo `User ↔ Company` com posição (`GESTOR`, `SUPORTE`, etc.) e validação de existência de empresa/usuário (404) e unicidade (409).
- Rotas protegidas: exigem header `Authorization: Bearer <access token>` (JWT, M4) e o contexto autenticado resolve o `userId`.
- Testes de isolamento entre tenants: usuário do tenant A não lê empresas/memberships do tenant B.

**M4 (Autenticação JWT) concluído.**

- Módulo `auth`:
  - Portas `TokenService` e `RefreshTokenRepository` (`application/ports`).
  - Use cases `Login`, `RefreshToken` (com rotação e revogação) e `Logout` (`application/use-cases`).
  - `JoseTokenService` (`infrastructure/security`) — HS256 via `jose`, segredos e TTLs de access/refresh vindos de env.
  - `DrizzleRefreshTokenRepository` + tabela `refresh_tokens` (`token_hash`, `user_id`, `expires_at`, `revoked_at`, `replaced_by_id`, `created_at`) na migration `0001_supreme_wong.sql`.
  - Rotas `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout` documentadas via Scalar.
- **Fluxo:** login valida credenciais (hash seguro, nunca texto puro) e emite access + refresh; refresh rotaciona (revoga o antigo e grava o novo na mesma transação lógica); logout revoga o refresh; token já revogado/reutilizado é recusado com 401.
- **Proteção das rotas:** `createAuthenticateHook` (`infrastructure/http/authenticate.ts`) valida `Authorization: Bearer <access token>` e injeta `request.auth = { userId }`; rotas sem token recebem 401 `UNAUTHORIZED`.
- Env: `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` (obrigatórios com ≥ 32 caracteres; defaults de desenvolvimento), `JWT_ACCESS_TTL` (default `15m`), `JWT_REFRESH_TTL` (default `30d`). Em produção, os defaults de desenvolvimento são rejeitados.
- **Nota técnica:** `refresh-token.ts` cria o novo token **antes** de revogar o anterior para respeitar a FK `refresh_tokens.replaced_by_id → refresh_tokens.id`.
- 189 testes passando (32 arquivos); coverage ~96% statements/lines/functions, ~90% branches.

**M5 (Autorização por permissões) concluído.**

- Módulo `permissions`:
  - `domain/permission.ts` — tipo `Permission` com a lista inicial do AGENTS §10, `ALL_PERMISSIONS`, `isPermission` e `toPermissions`.
  - `domain/role.ts` — cargos iniciais (§11.1) e presets `ROLE_PERMISSIONS` (ADMINISTRADOR, GESTOR, SUPORTE, TESTADOR, DESENVOLVEDOR) usados como **default de resolução** (não acoplam permissões fixas a cargos).
  - `domain/dashboard-policy.ts` — `DashboardPolicy` (política padrão da empresa + permissões por função + por usuário + negação por usuário + `allowPersonalKanbanManagement`) e `canManageBoard(role, userId, scope)` que distingue quadro da empresa (`company`) do quadro próprio (`own`) — requisito §11 atendido.
  - `application/ports/permission-resolver.ts` — porta `PermissionResolver.resolve(userId, companyId) → AuthenticatedUser`.
  - `application/services/authorization-service.ts` — `assertPermission` (lança `ForbiddenError` 403) e `assertCompanyContext`.
- `AuthenticatedUser` (`shared/application/authenticated-user.ts`): `{ userId, companyId, permissions }` — contexto resolvido nas rotas e validado nos use cases.
- Persistência: coluna `memberships.permissions` (jsonb) na migration `0002_small_nighthawk.sql`; permissões explícitas têm precedência e membership vazia cai para o preset do cargo.
- `MembershipPermissionResolver` (`memberships/infrastructure/resolvers`): membership ativa + permissões explícitas (ou preset) + política de dashboard.
- Use cases protegidos: `GetCompany` (`company.read`), `UpdateCompany` (`company.update`), `CreateMembership` (`users.manage` + acesso à empresa). `ListCompanies`/`ListMemberships` (dados do próprio usuário) e `CreateCompany` (bootstrap) não exigem permissão adicional.
- Rotas: `GET/PATCH /companies/:companyId` e `POST /memberships` resolvem o `AuthenticatedUser` via `PermissionResolver`; usuário sem permissão recebe 403 `FORBIDDEN`.
- 232 testes passando (36 arquivos); coverage 96.21% statements / 92.27% branches / 98.78% functions / 96.2% lines.

Para subir o banco localmente: `docker run --name orbis-postgres -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=orbis -p 5432:5432 -d postgres:17-alpine`, depois `npm run db:migrate` na API.

**M6 (Catálogo de software: systems / versions / releases / storage) concluído.**

- Módulos `systems`, `versions` e `releases` com entidades, use cases, repositórios Drizzle e rotas HTTP:
  - `POST/GET /companies/:companyId/systems`, `GET/PATCH/DELETE /companies/:companyId/systems/:systemId` — CRUD de `System` (tenant-owned), isolamento por `MembershipAccessService`.
  - `POST/GET /companies/:companyId/systems/:systemId/versions`, `GET/PATCH/DELETE /companies/:companyId/versions/:versionId` — CRUD de `SystemVersion` vinculado a um sistema.
  - `POST/GET /companies/:companyId/releases`, `GET/DELETE /companies/:companyId/releases/:releaseId`, `POST /companies/:companyId/releases/:releaseId/publish` — `Release` em rascunho que, ao publicar, grava o artefato no storage e preenche metadados (status `PUBLISHED`, checksum SHA-256, `sizeBytes`, `storageKey`, `publishedAt`).
- Porta `ArtifactStorage` (`application/ports`) com implementação `LocalArtifactStorage` (dev) que grava fora do PostgreSQL em `ARTIFACT_STORAGE_PATH` (default `./storage/releases`); preparada para `S3ArtifactStorage` em produção. A porta é restrita a releases/executáveis — anexos de requisições/tarefas ficam no PostgreSQL (M8.5).
- Permissionamento: `systems.read`/`systems.manage`, `versions.manage`, `releases.manage` (presets de `GESTOR`; `SUPORTE`/`TESTADOR` só leem `systems.read`); usuário sem permissão recebe 403 `FORBIDDEN`; recurso de outro tenant é tratado como 404 `NOT_FOUND`.
- Tabelas `systems`, `system_versions` e `releases` já existiam no schema base (migration `0000_eminent_wolfpack.sql`) — nenhuma migration nova foi necessária.
- 314 testes passando (46 arquivos).

Próxima etapa: **M7 — Requisições** (CRUD, prioridade `LOW | MEDIUM | HIGH`, responsável, sistema/versão opcionais, `estimatedHours`, datas e histórico).

## Nota sobre o banco via Docker

Além do fluxo manual (`docker run` + `npm run db:migrate`), agora existe `API/Dockerfile` + `API/docker/db-init.sh`: na primeira subida com volume vazio, a imagem aplica as migrations e registra cada uma no journal do drizzle (`drizzle.__drizzle_migrations`), então `npm run db:migrate` não reaplica nada. Validado empiricamente (build + container de teste em 5433).

## Decisões já tomadas

### Stack

Backend:

- Node.js
- TypeScript
- Fastify
- Drizzle
- PostgreSQL
- Redis opcional

Frontend:

- React
- Vite
- TypeScript
- shadcn/ui
- Tailwind

### Estrutura de aplicações

```text
/
├── API/
├── app/
└── docs/
```

Não criar um monorepo de pacotes compartilhados neste primeiro momento.

## Decisões arquiteturais

### Backend

Clean Architecture modular:

```text
presentation
    ↓
application
    ↓
domain

infrastructure
    ↓
implementa portas
```

O domínio não conhece Fastify, Drizzle, PostgreSQL, Redis ou JWT.

### Frontend

Arquitetura orientada a features.

Componentes visuais não devem conter regras de negócio.

Requisitos visuais imprescindíveis:

- **totalmente responsivo em mobile** (mobile-first) em todas as telas;
- **visual elegante e tecnológico** via design system (shadcn/ui) e tokens de tema (Tailwind);
- **personalização total por usuário** (tema claro/escuro, cor de destaque, densidade), persistida por usuário.

### Multiempresa

```text
User
  │
  ├── Membership ── Company A
  └── Membership ── Company B
```

O usuário é global.

Os dados de negócio são tenant-aware.

## Modelo de domínio inicial

```text
Company
 ├── Membership
 │    └── User
 │
 ├── System
 │    └── SystemVersion
 │          └── Release
 │
 ├── Requisition
 │    ├── Attachment
 │    └── Task
 │          ├── StatusHistory
 │          ├── PauseIntervals
 │          ├── TimeEntries
 │          └── Attachment
 │
 ├── Notification
 ├── NotificationPreference
 ├── Conversation
 │    └── Message
 └── AuditLog
```

Este diagrama é conceitual e não representa ainda o schema final.

## Pontos que precisam permanecer consistentes

### Requisição ≠ tarefa

Uma requisição é uma demanda.

Uma tarefa é trabalho executável.

Não misturar esses conceitos para simplificar a implementação.

### Estimativa ≠ horas realizadas

`estimatedHours` indica planejamento.

`workedHours`/time entries indicam execução.

### Previsão ≠ entrega real

A data prevista é calculada.

A data de entrega real é registrada quando a execução termina.

### Status atual ≠ histórico

O estado atual é necessário para consulta rápida.

O histórico é necessário para auditoria, métricas e timeline.

## Regra de capacidade

Implementar inicialmente:

```text
dailyCapacity = availableDevelopers * dailyHoursPerDeveloper

requiredDays = estimatedHours / dailyCapacity

plannedDeliveryDate =
  addBusinessDays(startDate, requiredDays)
```

Arredondamento e regra exata de inclusão do dia inicial devem ser definidos no serviço de domínio e cobertos por testes.

Não implementar essa regra diretamente em controller, query SQL ou componente React.

## Questões ainda abertas

Estas decisões não devem ser inventadas silenciosamente:

1. Um usuário pode pertencer a várias empresas?
   - A arquitetura já está preparada para isso.
   - Comportamento de UX ainda precisa ser definido.

2. Qual o conjunto final de roles?
   - A autorização deve ser permission-based.
   - Roles podem ser presets.

3. Funcionário e usuário serão entidades diferentes?
   - Recomendação: identidade `User` + perfil/membership de funcionário.
   - **REQUISITO DOCUMENTADO:** o cadastro de funcionários deve possuir o campo **cargo** (posição/função na empresa), com cargos iniciais como `Administrador`, `Gestor`, `Suporte`, `Testador`, `Desenvolvedor`, etc. O cargo é atributo funcional de RH; a autorização continua baseada em permissões (cargo não substitui roles/permissões).
   - A decisão final deve acompanhar o modelo de RH desejado.

4. Qual storage será usado para executáveis (releases)?
   - Dev: **IMPLEMENTADO no M6** — `LocalArtifactStorage` grava no filesystem local (`ARTIFACT_STORAGE_PATH`).
   - Produção: storage S3-compatible é recomendado (porta `ArtifactStorage` já permite implementar `S3ArtifactStorage` sem alterar o domínio).
   - Criar uma porta para não acoplar o domínio. ✅
   - **DECIDIDO:** anexos de requisições/tarefas (imagens, PDFs e links) NÃO usam essa porta — ficam no próprio PostgreSQL, em BYTEA numa tabela dedicada (`attachment_blobs`), com limite de tamanho por arquivo. Análise e vereditos em `docs/architecture.md §17.2`.

5. Quais canais de notificação serão suportados inicialmente?
   - In-app é o primeiro candidato.
   - Email/push podem ser adicionados sem alterar o domínio.

6. Feriados serão globais ou por empresa?
   - O requisito de dias úteis torna esse ponto importante.
   - Modelar de forma que possa ser configurado por empresa.

7. Como calcular capacidade quando um programador estiver parcialmente comprometido com outras requisições?
   - A fórmula inicial é simples.
   - Planejamento por carga já ocupada pode ser uma segunda versão.

8. Como persistir as preferências de aparência (tema, cor, densidade)?
   - Requisito imprescindível: personalização total por usuário.
   - **IMPLEMENTADO no M0:** fallback temporário em armazenamento local (`orbis:appearance`), com `ThemeProvider` no app. Quando a identidade existir (M3/M4), migrar para persistência via API por usuário.
   - A decisão final deve acompanhar o modelo de identidade (questão 3).

9. Enums provisórios criados no schema base (M1) — valores finais a validar nos use cases dos módulos correspondentes:
   - `requisition_status` = `OPEN | IN_PROGRESS | PAUSED | DONE | CANCELLED` (M7).
   - `release_channel` = `STABLE | BETA` e `release_status` = `DRAFT | PUBLISHED` — **validados no M6** (entidade `Release`, `Release.create` default `STABLE`/`DRAFT`).
   - Já definitivos conforme documentação: `priority` = `LOW | MEDIUM | HIGH`, `task_status` = `TODO | IN_PROGRESS | PAUSED | DONE`, `attachment_kind` = `FILE | LINK`.

## Primeiro milestone recomendado

### Milestone 0 — Fundação

Criar:

```text
API/
app/
docs/
```

Configurar:

- Node;
- TypeScript strict;
- Fastify;
- React/Vite;
- Tailwind;
- shadcn/ui;
- design system e tokens de tema (claro/escuro, cor de destaque, densidade);
- base responsiva mobile-first;
- PostgreSQL;
- Drizzle;
- migrations;
- variáveis de ambiente;
- logger;
- tratamento de erros;
- health check;
- lint;
- testes.

### Milestone 1 — Identidade e tenant

Implementar:

- company;
- user;
- membership;
- **cargo do funcionário** (posição/função na empresa, ex.: `Administrador`, `Gestor`, `Suporte`, `Testador`, `Desenvolvedor`, etc.) — atributo funcional de RH, distinto de roles/permissões;
- roles/policies;
- login;
- refresh;
- logout;
- autorização;
- seleção de empresa.

### Milestone 2 — Catálogo de software

Implementar:

- systems;
- versions;
- releases;
- storage abstraction.

### Milestone 3 — Requisições

Implementar:

- CRUD;
- prioridade;
- responsável;
- equipe;
- sistema;
- versão;
- estimativa;
- datas;
- histórico.

### Milestone 3.5 — Anexos de requisições e tarefas

Implementar:

- tabelas `attachments` (metadados) e `attachment_blobs` (BYTEA) e domínio de anexos;
- anexo de arquivos (imagens, PDFs, documentos) no próprio PostgreSQL, com limite de tamanho;
- anexo de links (documentação externa) como metadados;
- validação de tipo e tamanho no backend;
- endpoints de anexos em requisições e tarefas (upload, listagem, download, remoção);
- exibição dos anexos no detalhe da requisição/tarefa (card no Kanban), responsive e no tema do usuário.

### Milestone 4 — Tarefas e Kanban

Implementar:

- CRUD;
- quatro status;
- drag and drop;
- iniciar;
- pausar;
- retomar;
- concluir;
- histórico;
- pausas;
- apontamento.

### Milestone 5 — Capacidade e timeline semanal

Implementar:

- disponibilidade;
- horas diárias;
- dias úteis;
- previsão;
- timeline semanal;
- filtros.

### Milestone 6 — Timeline mensal/anual

Implementar somente depois da capacidade estar confiável.

A especificação original marca a dashboard mensal/anual como etapa a ser feita por último. fileciteturn0file0L70-L94

### Milestone 7 — Notificações e chat

Implementar:

- preferências;
- notificações in-app;
- WebSocket;
- conversas;
- mensagens;
- read/unread.

### Milestone 8 — Relatórios e auditoria

Implementar:

- relatório de tarefas;
- filtros;
- auditoria;
- métricas.

## Critério para iniciar cada milestone

Antes de iniciar um milestone:

1. ler `AGENTS.md`;
2. ler `ai_context.md`;
3. ler `architecture.md`;
4. verificar este handoff;
5. inspecionar o código atual;
6. listar decisões que possam ser afetadas;
7. implementar somente o necessário.

## Critério de conclusão

Uma feature somente está pronta quando:

- backend está protegido por autorização;
- tenant isolation está validado;
- regra de negócio possui testes;
- API possui validação;
- frontend possui estados de loading/error/empty;
- migrations estão versionadas;
- documentação está coerente;
- build passa;
- testes passam.

## Próxima ação recomendada para o agente

Começar pelo bootstrap das duas aplicações e pela infraestrutura mínima.

Não iniciar pelo Kanban ou pela timeline.

A primeira entrega deve ser capaz de subir localmente:

```text
PostgreSQL
API
app
```

e responder:

```text
GET /health
```

com a aplicação React acessível no navegador.

Depois disso, iniciar o domínio de autenticação + empresa + membership.
