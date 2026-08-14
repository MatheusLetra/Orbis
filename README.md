# Orbis

Plataforma web **multiempresa** para gestão do ciclo de trabalho de equipes de desenvolvimento: requisições, tarefas, capacidade da equipe, Kanban, timelines, sistemas, versões, releases, notificações e comunicação interna.

## O que é o Orbis

O Orbis é um SaaS de gestão de desenvolvimento construído do zero. O conceito central é a **Requisição** (demanda formal de trabalho), que pode possuir **tarefas** executáveis no Kanban.

Principais características:

- **Multiempresa (tenants)**: `Company` = tenant, `User` = identidade global, `Membership` = vínculo entre usuário e empresa.
- **Autenticação JWT**: login, refresh token com rotação/revogação e logout; rotas protegidas exigem `Authorization: Bearer <access token>`.
- **Kanban** com colunas personalizáveis (A Fazer, Em Andamento, Pausado, Concluído) e histórico de status imutável.
- **Ciclo de pausas transacional**: pausar abre um intervalo, retomar ou concluir fecha a pausa e calcula sua duração em segundos.
- **Timelines** semanal, mensal e anual com filtros e indicadores.
- **Cálculo de capacidade e previsão** de entrega baseado em dias úteis e horas da equipe.
- **Sistemas → Versões → Releases** com armazenamento de artefatos abstraído (`ArtifactStorage`); em desenvolvimento os executáveis são gravados no filesystem local (`ARTIFACT_STORAGE_PATH`, default `./storage/releases`), fora do PostgreSQL.
- **Anexos** (imagens, PDFs, links) em requisições e tarefas, persistidos no PostgreSQL.
- **Notificações configuráveis in-app** e **chat direto persistido**, ambos isolados por tenant.
- **Visual mobile-first**, elegante e totalmente personalizável por usuário (tema claro/escuro, cor de destaque, densidade).

> **Regra de domínio:** o termo oficial é **Requisição**. O conceito de "ordem" do sistema original não deve ser utilizado.

## Stack

### API (`API/`)

- Node.js + TypeScript (strict)
- Fastify
- Drizzle ORM
- PostgreSQL
- Zod
- Logger estruturado (pino) com `request id` e redact de segredos
- Erros tipados com envelope de resposta `{ error: { code, message, details? } }`
- JWT
- WebSocket (quando necessário)
- Redis (opcional, somente com necessidade real)
- Documentação de API via **Scalar** (`@scalar/fastify-api-reference` + `@fastify/swagger`)

### App (`app/`)

- React + Vite + TypeScript (strict)
- shadcn/ui
- Tailwind CSS v4

`API` e `app` são aplicações independentes, cada uma com `package.json`, dependências, TypeScript, scripts e build próprios.

## Estrutura do repositório

```text
/
├── API/          → Backend (Fastify)
├── app/          → Frontend (React/Vite)
├── docs/         → Documentação do projeto e regras para agentes de IA
└── README.md
```

Documentação detalhada:

- `docs/AGENTS.md` — regras de desenvolvimento e nomenclatura.
- `docs/ai_context.md` — contexto rápido e decisões fundamentais.
- `docs/architecture.md` — arquitetura detalhada.
- `docs/PLANO-IMPLEMENTACAO.md` — plano de implementação em módulos (M0–M18).
- `docs/ai_handoff.md` — estado atual do projeto e próxima ação.

## Como executar localmente

Pré-requisitos: Node.js 20+ (recomendado 22+), npm e PostgreSQL (para M1 em diante).

Para auditorias browser reais, instale as dependências do orquestrador na raiz e o Chromium empacotado:

```bash
npm install
npm run audit:install
```

### 1. Banco de dados (PostgreSQL)

Suba um PostgreSQL local (ex.: via Docker) com banco `orbis`. Há duas opções:

**Opção A — imagem pronta (schema aplicado na primeira execução):**

```bash
cd API
docker build -t orbis-db .   # contém migrations + script de init
docker run --name orbis-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=orbis \
  -p 5432:5432 -d orbis-db
```

Na primeira subida com volume vazio, o script `docker/db-init.sh` aplica o SQL das migrations e registra cada uma no journal do drizzle (`drizzle.__drizzle_migrations`), então `npm run db:migrate` não reaplica nada.

**Opção B — Postgres puro (aplicar migrations manualmente):**

```bash
docker run --name orbis-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=orbis \
  -p 5432:5432 -d postgres:17-alpine
```

### 2. API

```bash
cd API
npm install
cp .env.example .env   # ajuste as variáveis se necessário (DATABASE_URL, JWT secrets)
npm run db:migrate     # aplica as migrations (schema base)
npm run dev            # sobe em http://localhost:3333
```

Verificar o health check:

```bash
curl http://localhost:3333/health
```

Documentação da API (Scalar) — **todo endpoint é documentado automaticamente**:

```text
http://localhost:3333/reference             → UI interativa
http://localhost:3333/reference/openapi.json → spec OpenAPI (JSON)
http://localhost:3333/reference/openapi.yaml → spec OpenAPI (YAML)
```

Endpoints já implementados:

```text
POST /auth/login                         → autentica e retorna access + refresh tokens
POST /auth/refresh                       → rotaciona o refresh token
POST /auth/logout                        → revoga o refresh token

POST   /users                            → cria usuário (identidade global)

POST   /companies                        → cria empresa + membership GESTOR do dono
GET    /companies                        → lista empresas do usuário autenticado
GET    /companies/:companyId             → obtém empresa com acesso
PATCH  /companies/:companyId             → atualiza empresa

POST   /memberships                      → vincula usuário a empresa
GET    /memberships                      → lista memberships do usuário autenticado

POST   /companies/:companyId/systems                → cria um sistema
GET    /companies/:companyId/systems                → lista sistemas da empresa
GET    /companies/:companyId/systems/:systemId      → obtém um sistema
PATCH  /companies/:companyId/systems/:systemId      → atualiza um sistema
DELETE /companies/:companyId/systems/:systemId      → remove um sistema

POST   /companies/:companyId/systems/:systemId/versions → cria uma versão para o sistema
GET    /companies/:companyId/systems/:systemId/versions → lista versões do sistema
GET    /companies/:companyId/versions/:versionId       → obtém uma versão
PATCH  /companies/:companyId/versions/:versionId       → atualiza uma versão
DELETE /companies/:companyId/versions/:versionId       → remove uma versão

POST   /companies/:companyId/releases                → cria uma release em rascunho
GET    /companies/:companyId/releases                → lista releases da empresa
GET    /companies/:companyId/releases/:releaseId     → obtém uma release
POST   /companies/:companyId/releases/:releaseId/publish → publica a release (grava artefato no storage)
DELETE /companies/:companyId/releases/:releaseId     → remove uma release

POST  /companies/:companyId/tasks                    → cria uma tarefa
GET   /companies/:companyId/tasks                    → lista tarefas
GET   /companies/:companyId/tasks/:taskId            → obtém tarefa e histórico
PATCH /companies/:companyId/tasks/:taskId            → atualiza uma tarefa
PATCH /companies/:companyId/tasks/:taskId/status     → inicia, pausa, retoma ou conclui uma tarefa
POST  /companies/:companyId/tasks/:taskId/time-entries → registra horas por duração
GET   /companies/:companyId/tasks/:taskId/time-entries → lista horas e total da tarefa
GET   /companies/:companyId/timeline/weekly             → timeline semanal (`weekStart` na segunda-feira)
GET   /companies/:companyId/timeline/monthly            → timeline mensal (`period=YYYY-MM`)
GET   /companies/:companyId/timeline/yearly             → timeline anual (`year=YYYY`)

GET   /companies/:companyId/notifications               → lista notificações próprias e não lidas
PATCH /companies/:companyId/notifications/:notificationId/read → marca notificação própria como lida
GET   /companies/:companyId/notification-preferences    → lista preferências próprias
PATCH /companies/:companyId/notification-preferences    → atualiza preferência in-app própria

GET   /companies/:companyId/conversations                              → lista conversas diretas próprias
POST  /companies/:companyId/conversations                              → cria conversa direta
GET   /companies/:companyId/conversations/:conversationId/messages     → lista histórico paginado
POST  /companies/:companyId/conversations/:conversationId/messages     → envia mensagem
PATCH /companies/:companyId/conversations/:conversationId/read         → marca conversa como lida
```

As rotas de negócio (`/companies`, `/memberships`, `/systems`, `/versions`, `/releases`) são protegidas e exigem o header `Authorization: Bearer <access token>`.

### 3. App

```bash
cd app
npm install
cp .env.example .env   # ajuste VITE_API_URL se necessário
npm run dev            # sobe em http://localhost:5173
```

## Scripts

### API

| Script | Descrição |
|---|---|
| `npm run dev` | Servidor com reload automático |
| `npm run build` | Compilação TypeScript |
| `npm start` | Executa o build |
| `npm run lint` | Lint + formatação (Biome) |
| `npm run lint:fix` | Lint + formatação com correção automática |
| `npm run typecheck` | Verificação de tipos |
| `npm test` | Testes (vitest) |
| `npm run test:coverage` | Testes com relatório de cobertura |
| `npm run db:generate` | Gera migration a partir do schema |
| `npm run db:migrate` | Aplica migrations no banco |
| `npm run db:studio` | Abre o Drizzle Studio |

### App

| Script | Descrição |
|---|---|
| `npm run dev` | Dev server com HMR |
| `npm run build` | TypeScript + build Vite |
| `npm run preview` | Pré-visualiza o build de produção |
| `npm run lint` | Lint + formatação (Biome) |
| `npm run lint:fix` | Lint + formatação com correção automática |
| `npm run typecheck` | Verificação de tipos |
| `npm test` | Testes (vitest) |
| `npm run test:coverage` | Testes com relatório de cobertura |

### Auditoria browser

As auditorias funcionais e visuais reais usam `@playwright/test` com Chromium empacotado, fixtures temporárias e PostgreSQL Docker isolado. `jsdom` e testes de API não substituem esta suíte.

| Script | Descrição |
|---|---|
| `npm run audit:install` | Instala o Chromium usado pela auditoria |
| `npm run audit:browser` | Executa todas as suítes serialmente |
| `npm run audit:browser:headed` | Executa todas as suítes em browser visível |
| `npm run audit:responsive` | Executa a suíte de responsividade |
| `npm run audit:attachments` | Executa Attachments |
| `npm run audit:time-entries` | Executa TimeEntry |
| `npm run audit:capacity` | Executa Capacity |
| `npm run audit:timeline` | Executa a timeline semanal |
| `npm run audit:notifications` | Executa a central de notificações |
| `npm run audit:chat` | Executa o Chat |

Cada execução gera relatório HTML, JSON, screenshots, vídeos/traces em `artifacts/browser-audit/`. Falhas são classificadas como ambiente, fixture, funcional, visual, acessibilidade ou console inesperado. A execução é serial quando depende de banco e o avanço do roadmap fica bloqueado enquanto qualquer auditoria obrigatória falhar ou não for executada.

## Testes e cobertura

A API e o app possuem cobertura de testes obrigatória, com a meta de se aproximar de **100% do código** (unitários, integração, API e frontend).

```bash
cd API && npm run test:coverage
cd app && npm run test:coverage
```

Thresholds mínimos definidos no `vitest.config.ts` de cada aplicação (~95% de statements/lines/functions e ~90% de branches). O relatório é gerado em `coverage/`.

## Estado do projeto

O projeto está sendo construído em módulos definidos em `docs/PLANO-IMPLEMENTACAO.md`:

| Módulo | Descrição | Status |
|---|---|---|
| M0 | Fundação dos projetos (API + app, tema, responsividade) | ✅ Concluído |
| M1 | Infraestrutura de dados (PostgreSQL + Drizzle + migrations) | ✅ Concluído |
| M2 | Núcleo compartilhado (config, erros, logging, env) | ✅ Concluído |
| M3 | Identidade: companies / users / memberships | ✅ Concluído |
| M4 | Autenticação (JWT, login, refresh, logout) | ✅ Concluído |
| M5 | Autorização por permissões | ✅ Concluído |
| M6 | Catálogo de software: systems / versions / releases / storage | ✅ Concluído |
| M7 | Requisições | ⏳ Próximo |
| M12 | Pausas e apontamento de horas | ✅ Concluído; M12.4 validada manualmente |
| M13 | Capacidade e previsão | ✅ Concluído |
| M14 | Timeline semanal | ✅ Concluído; M14.1 cobre todos os itens |
| M15 | Timeline mensal/anual | ✅ Concluída; M15.1 e M15.2 concluídas |
| M16 | Notificações persistidas in-app | ✅ Concluída |
| M17 | Chat direto persistido e tenant-aware | ✅ Concluída |

O estado atual e a próxima ação recomendada estão sempre em `docs/ai_handoff.md`. M17 está concluída com transporte HTTP explícito, sem WebSocket ou polling; a próxima milestone formal é M18 — Relatórios.
