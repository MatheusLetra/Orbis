# Architecture - Orbis

## Visão

Orbis é um monólito modular multiempresa. O browser React/Vite chama a API Fastify por HTTP autenticado; a API usa casos de uso, domínio e repositories Drizzle sobre PostgreSQL. PostgreSQL é a fonte de verdade. Scalar/OpenAPI é gerado pelos schemas das rotas.

```text
Browser (React/Vite)
        |
        v
HTTP + JWT -> Fastify/HTTP -> Application -> Domain
                                  ^            |
                                  |            v
                         Infrastructure -> PostgreSQL
```

O domínio não depende de Fastify, Drizzle, Zod, JWT ou APIs do browser. Redis, WebSocket, polling, EventSource, e-mail, providers externos e storage externo não fazem parte do runtime atual.

O frontend possui um padrão incremental de lookup visual por ID em `app/src/components/common/id-lookup-field.tsx`. O componente é orientado por adapter, mantém o ID separado do label, usa React Query com `companyId` na query key, propaga `AbortSignal` e só consulta quando o diálogo abre. O Chat usa o endpoint específico `GET /companies/:companyId/chat/participants?search=` com `chat.use`; o lookup genérico de membros continua exigindo `users.read`.

## Estrutura

```text
API/src/{config,shared,modules,infrastructure}
app/src/{app,components,features,lib}
API/src/infrastructure/database/{schema.ts,migrations}
audit/{scripts,specs,fixtures}
docs/{milestones,operations}
```

Módulos reais: auth, users, companies, memberships, permissions, systems, versions, releases, requisitions, tasks, capacity, timeline, notifications, chat, reports, attachments e audit. Application usa ports, DTOs, parsers e UoW quando necessário. Frontend usa clients, parsers runtime, React Query/query keys tenant-aware, AbortSignal e stale protection.

Além das rotas operacionais, M21 registra `/admin`, `/admin/companies`, `/admin/users`, `/admin/requisitions`, `/admin/systems`, `/admin/versions`, `/admin/releases` e `/admin/audit`. O painel é tenant-aware, usa capabilities efetivas e mantém operações sem contrato como API-only.

## Identidade e tenant

`Company` é tenant; `User` é identidade global; `Membership` liga ambos e contém `position`, permissões explícitas e estado ativo. O cargo pode resolver preset, mas autorização continua permission-based. Cada use case tenant-owned recebe actor/contexto e valida membership, empresa ativa e `companyId`; ausência e cross-tenant não revelam dados.

Não há fluxo oficial de criação ou promoção MASTER. `POST /users`, `POST /companies` e `POST /memberships` são contratos de API, sem tela frontend correspondente.

## Contratos de domínio

Tasks têm `TODO`, `IN_PROGRESS`, `PAUSED`, `DONE`; histórico é append-only e `DONE` é terminal. O Kanban é uma projeção de quatro colunas fixas, sem Board/Column persistidos, reorder ou endpoint próprio. Pausas e transições usam Unit of Work e `FOR UPDATE`. TimeEntries são append-only por duração manual e separados de estimativa/capacidade.

Capacity calcula desenvolvedores elegíveis, horas diárias e dias úteis para simulação explícita; a UI não reproduz a fórmula. Timelines e Reports são read models somente leitura. Chat é direto entre dois membros, persistido e paginado por cursor; Notifications são in-app persistidas e carregadas explicitamente.

## Storage

Attachments têm metadados em `attachments` e FILE em `attachment_blobs.data BYTEA`; o checksum é SHA-256, o limite atual é 10 MB e listas nunca carregam o blob. Download é sob demanda e remoção é transacional/cascade.

Releases têm `artifactLocation` textual, trimado, não vazio quando publicado e limitado a 2048 caracteres. O Orbis não armazena, resolve, acessa, baixa, faz HEAD, checksum, MIME inspection ou validação externa. Não há armazenamento físico de Releases, filesystem, S3/provider ou endpoint de download binário.

## Autenticação, autorização e segurança

Login emite access JWT curto; refresh usa cookie HttpOnly, rotação, revogação e hash SHA-256 no banco. O access token fica em memória no app. CORS exige origem configurada e credenciais; produção exige HTTPS e segredos fortes. Pino registra request ID, rota, status e duração sem tokens/senhas. Há headers de segurança e rate limiting em memória para login/refresh.

## HTTP e health

Rotas são protegidas por hook Bearer, têm schema OpenAPI e retornam erros no envelope `{ error: { code, message, details? } }`. `/health` informa estado geral; `/health/live` não usa banco; `/health/ready` consulta banco e retorna 503 quando indisponível. Scalar está em `/reference` e specs em `/reference/openapi.json` e `/reference/openapi.yaml`.

## Banco e migrations

O schema canônico está em `API/src/infrastructure/database/schema.ts`; as migrations versionadas estão em `API/src/infrastructure/database/migrations`. Alterações devem ser feitas no schema, geradas com `npm run db:generate`, revisadas e aplicadas com `npm run db:migrate`. Não há reset oficial. Consulte [`DEVELOPER_MANUAL.md`](DEVELOPER_MANUAL.md) para o dicionário completo das 22 tabelas.

## Testes e evolução

Vitest cobre domínio, aplicação, HTTP, PostgreSQL e app; Playwright usa Chromium real, fixtures isoladas, PostgreSQL temporário, um worker e artifacts. Novas features devem preservar contrato, parser, autorização, tenant isolation, UoW/concorrência, acessibilidade/mobile, OpenAPI, testes, coverage e documentação. M21 está concluída sem migration nova e sem storage de Release.

## Chat participant lookup

O Chat possui uma leitura tenant-aware específica para seleção de participante. A rota não amplia `users.read`: `ChatAuthorizationService` exige `chat.use`, valida o ator no tenant ativo e o repository retorna somente usuários ativos com membership ativa, nome e ID, limitados a 50. A criação da conversa continua validando novamente o participante no backend; o frontend não é autoridade.

## Backlog futuro pós-M21

M22 ainda não foi definida ou iniciada. Notifications Lifecycle, transporte em tempo real, canais e-mail/push, evolução de Chat, administração complementar e operações de retenção/filas/observabilidade são apenas backlog futuro. Nenhum desses itens está implementado ou é bloqueio do sistema atual.

O runtime continua HTTP-only e PostgreSQL permanece a fonte da verdade. Não há WebSocket, scheduler, e-mail, push, Redis ou storage externo. Releases continuam usando somente `artifactLocation`, e Attachments continuam armazenados em `attachment_blobs.data BYTEA`.
