# Architecture — Orbis

## 1. Objetivo arquitetural

O Orbis deve ser um sistema SaaS multiempresa para gestão do ciclo de trabalho de equipes de desenvolvimento.

A arquitetura deve suportar:

- múltiplas empresas;
- usuários e funcionários;
- autorização;
- requisições;
- tarefas;
- Kanban;
- timelines;
- capacidade;
- sistemas;
- versões;
- releases;
- notificações;
- chat;
- auditoria.

O objetivo não é somente fazer o sistema funcionar. A arquitetura deve permitir evolução sem transformar o código em um conjunto de controllers, componentes e queries acoplados.

## 2. Visão geral

```text
                         ┌──────────────────────┐
                         │       Browser        │
                         │   React / Vite       │
                         └──────────┬───────────┘
                                    │ HTTPS
                                    │ WebSocket
                         ┌──────────▼───────────┐
                         │         API          │
                         │ Fastify / Node / TS  │
                         └──────────┬───────────┘
                                    │
                ┌───────────────────┼───────────────────┐
                │                   │                   │
        ┌───────▼────────┐ ┌────────▼────────┐ ┌────────▼───────┐
        │   Application   │ │     Domain      │ │ Infrastructure │
        │   Use Cases     │ │ Business Rules  │ │ DB/Cache/etc.  │
        └─────────────────┘ └─────────────────┘ └───────┬────────┘
                                                          │
                              ┌───────────────────────────┼─────────────┐
                              │                           │             │
                       ┌──────▼──────┐             ┌──────▼──────┐ ┌────▼────┐
                       │ PostgreSQL  │             │    Redis    │ │ Storage │
                       │ source of   │             │ optional    │ │ releases│
                       │ truth       │             │             │ │         │
                       └─────────────┘             └─────────────┘ └─────────┘
```

## 3. Princípio de dependência

A regra fundamental é:

> Dependências apontam para políticas e regras de negócio, não o contrário.

O domínio não deve conhecer:

- Fastify;
- Drizzle;
- PostgreSQL;
- Redis;
- JWT;
- React;
- browser APIs.

Application conhece as abstrações necessárias para executar casos de uso.

Infrastructure implementa essas abstrações.

## 4. Estrutura do repositório

```text
/
├── API/
│   ├── package.json
│   ├── tsconfig.json
│   ├── drizzle.config.ts
│   ├── .env.example
│   └── src/
│       ├── main.ts
│       ├── app.ts
│       ├── config/
│       ├── shared/
│       ├── modules/
│       └── infrastructure/
│
├── app/
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── .env.example
│   └── src/
│       ├── main.tsx
│       ├── app/
│       ├── components/
│       ├── features/
│       ├── pages/
│       ├── domain/
│       ├── services/
│       ├── hooks/
│       ├── lib/
│       └── types/
│
└── docs/
```

## 5. Backend

### 5.1 Camadas

```text
Presentation
    ↓
Application
    ↓
Domain

Infrastructure
    └── implementa interfaces/ports
```

### Presentation

Responsável por:

- HTTP;
- WebSocket;
- autenticação de request;
- parsing;
- validação;
- serialização;
- códigos HTTP.

Não deve conter regra de negócio.

### Application

Responsável por:

- use cases;
- transações de aplicação;
- orquestração;
- autorização de casos de uso;
- chamadas a ports;
- publicação de eventos.

Exemplos:

```text
CreateRequisition
UpdateRequisition
MoveTask
PauseTask
ResumeTask
CompleteTask
CalculateCapacity
RegisterTimeEntry
PublishRelease
SendMessage
UpdateNotificationPreferences
```

### Domain

Responsável por:

- entidades;
- value objects;
- invariantes;
- regras puras;
- serviços de domínio;
- eventos de domínio quando necessário.

Exemplo:

```text
Requisition
Task
Priority
TaskStatus
Capacity
BusinessCalendar
```

### Infrastructure

Responsável por:

- Drizzle;
- PostgreSQL;
- Redis;
- JWT;
- password hashing;
- storage;
- WebSocket adapter;
- email provider;
- logs;
- observabilidade.

## 6. Módulos do backend

```text
modules/
├── auth/
├── companies/
├── users/
├── permissions/
├── systems/
├── requisitions/
├── tasks/
├── capacity/
├── notifications/
├── chat/
└── audit/
```

Cada módulo é um bounded context leve.

Não é necessário criar microsserviços.

## 7. Auth e identidade

Modelo:

```text
User
  │
  └──< Membership >── Company
                         │
                         └── Role/Permission
```

Um `User` é uma identidade global.

`Membership` define o vínculo com uma empresa.

Isso permite:

- um usuário em várias empresas;
- permissões diferentes por empresa;
- isolamento tenant;
- troca de contexto de empresa.

**Implementação (M3/M4):** módulos `companies`, `users`, `memberships` e `auth`. O acesso às rotas de negócio é autenticado por JWT (`Authorization: Bearer`); o `userId` do contexto autenticado é a fonte de verdade para as consultas de empresas/memberships — nunca o `userId`/`companyId` enviado pelo cliente.

### Funcionário e cargo

O funcionário (perfil/membership dentro da empresa) deve possuir o atributo **cargo**, representando a posição/função dentro da empresa.

Cargos iniciais previstos (lista aberta):

- `ADMINISTRADOR`
- `GESTOR`
- `SUPORTE`
- `TESTADOR`
- `DESENVOLVEDOR`

O cargo é um atributo **funcional de RH**, distinto do mecanismo de autorização:

- a autorização permanece baseada em permissões (§19);
- o cargo não substitui roles/permissões nem acopla permissões fixas a cargos;
- o cargo pode ser usado para classificação/filtros e, quando aplicável, como entrada do cálculo de capacidade (§15, ex.: desenvolvedores disponíveis).

## 8. Multi-tenancy

### Regra

Todo use case que opera em recurso tenant-owned recebe o contexto:

```text
AuthenticatedUser
    ├── userId
    ├── companyId
    └── permissions
```

O `companyId` efetivo vem do contexto autenticado/selecionado e é validado contra o membership.

### Exemplo

```text
GET /requisitions/123
        ↓
authenticate
        ↓
resolve company context
        ↓
authorize requisition.read
        ↓
repository.findById(companyId, 123)
```

O repository deve receber `companyId`.

Evitar:

```text
repository.findById(123)
```

para entidades tenant-owned.

### Banco

Todas as tabelas tenant-owned devem possuir `company_id` quando aplicável.

Criar índices compostos quando necessário:

```text
(company_id, id)
(company_id, status)
(company_id, planned_delivery_date)
```

PostgreSQL RLS pode ser adicionado posteriormente.

## 9. Modelo de dados conceitual

```text
companies
    │
    ├── memberships ── users
    │
    ├── systems
    │      └── system_versions
    │              └── releases
    │
    ├── requisitions
    │      ├── requisition_assignees
    │      ├── attachments ── attachment_blobs (binários BYTEA)
    │      └── tasks
    │              ├── task_status_history
    │              ├── task_pause_intervals
    │              ├── time_entries
    │              └── attachments
    │
    ├── notification_preferences
    ├── notifications
    │
    ├── conversations
    │      └── messages
    │
    └── audit_logs
```

O schema final deve ser derivado dos use cases, não criado como um CRUD genérico.

## 10. Requisição

Entidade conceitual:

```text
Requisition
├── id
├── companyId
├── number
├── title
├── description
├── priority
├── status
├── requesterId
├── responsibleId
├── systemId?
├── systemVersionId?
├── estimatedHours
├── startDate
├── plannedDeliveryDate
├── deliveredAt?
├── createdAt
└── updatedAt
```

O nome `number` pode ser o identificador de negócio apresentado ao usuário.

## 11. Tarefa

```text
Task
├── id
├── companyId
├── requisitionId?
├── title
├── description
├── priority
├── status
├── assigneeId
├── startDate
├── plannedEndDate
├── completedAt?
├── createdAt
└── updatedAt
```

Uma tarefa pode existir sem requisição.

## 12. Status e histórico

Estado atual:

```text
TODO
IN_PROGRESS
PAUSED
DONE
```

Histórico:

```text
TaskStatusHistory
├── taskId
├── fromStatus
├── toStatus
├── changedBy
├── changedAt
└── metadata
```

Não editar histórico.

## 13. Pausas

```text
TaskPauseInterval
├── taskId
├── startedAt
├── endedAt
└── durationSeconds
```

Ao pausar:

```text
IN_PROGRESS → PAUSED
create pause interval
```

Ao retomar:

```text
PAUSED → IN_PROGRESS
close pause interval
```

Ao concluir:

```text
IN_PROGRESS → DONE
```

A aplicação deve decidir como tratar conclusão de tarefa que esteja pausada; não inventar silenciosamente se esse caso ainda não estiver definido.

## 14. Horas

Separar:

```text
estimatedHours
```

de:

```text
time_entries
```

Exemplo:

```text
TimeEntry
├── id
├── companyId
├── taskId
├── userId
├── startedAt?
├── endedAt?
├── durationMinutes
├── description
└── createdAt
```

A implementação inicial pode permitir apontamento manual por duração.

## 15. Capacidade

### Entradas

- programadores disponíveis;
- horas diárias;
- estimativa da requisição;
- calendário;
- feriados;
- disponibilidade.

### Serviço

```text
CapacityCalculator
```

Deve ser puro.

Exemplo conceitual:

```ts
calculatePlannedDelivery({
  startDate,
  estimatedHours,
  developers,
  dailyHours,
  calendar,
})
```

Saída:

```text
requiredWorkDays
plannedDeliveryDate
dailyCapacity
```

A solicitação original define a base como programadores disponíveis × horas diárias e adição de dias úteis. fileciteturn0file0L11-L15

## 16. Calendário de negócio

Criar uma abstração:

```text
BusinessCalendar
```

Responsabilidades:

- saber se um dia é útil;
- avançar N dias úteis;
- considerar fins de semana;
- futuramente considerar feriados.

Não colocar isso em SQL.

## 17. Sistemas, versões e releases

```text
System
   └── SystemVersion
           └── Release
```

Release:

```text
Release
├── id
├── companyId
├── systemVersionId
├── versionLabel
├── channel
├── status
├── artifactName
├── storageKey
├── checksum
├── sizeBytes
├── publishedAt
└── createdBy
```

O artefato físico é externo ao PostgreSQL.

Criar uma porta:

```text
ArtifactStorage
```

Implementações:

```text
LocalArtifactStorage
S3ArtifactStorage
```

### 17.1 Anexos de requisições e tarefas

Requisições e tarefas podem possuir anexos:

- **arquivos** (imagens, PDFs, documentos) — binário persistido **no próprio PostgreSQL** (BYTEA em tabela dedicada `attachment_blobs`); no PostgreSQL ficam tanto os metadados quanto o conteúdo;
- **links** (ex.: URLs para documentações externas) — persistidos apenas como metadados.

Modelo conceitual:

```text
Attachment
├── id
├── companyId
├── requisitionId?
├── taskId?          (exatamente um proprietário)
├── kind             (FILE | LINK)
├── fileName?
├── mimeType?
├── checksum?
├── sizeBytes?
├── url?             (apenas quando LINK)
├── title?
├── createdBy
└── createdAt

AttachmentBlob
├── attachmentId     (PK/FK → attachments.id, ON DELETE CASCADE)
└── data             (bytea)
```

Regras:

- validação de upload (tipo permitido e tamanho) no backend;
- anexo segue as permissões e o tenant da entidade pai;
- anexo não altera status nem capacidade;
- listar metadados nunca carrega o `bytea`;
- gravação/remoção de metadados + blob ocorre em uma única transação;
- a exclusão da requisição/tarefa propaga a exclusão dos anexos (cascade), com a regra documentada.

### 17.2 Armazenamento de binários: análise e decisão

Objetivo: armazenar os arquivos anexados (imagens, PDFs, documentos) com fonte de verdade única e operação simples.

Abordagens avaliadas:

| Abordagem | Vantagens | Desvantagens | Veredito |
|---|---|---|---|
| **BYTEA em tabela dedicada** (`attachment_blobs`) | TOAST move conteúdo grande para fora da linha automaticamente; listas de metadados não leem o blob; transacional; FK com cascade; backup único com o PostgreSQL; sem infraestrutura externa | Leitura carrega o binário em memória (exige limite de tamanho); backup tende a crescer | **Escolhida** |
| BYTEA inline na própria `attachments` | Mais simples | Infla a tabela de metadados; listas carregam linhas grandes | Rejeitada |
| Large Objects (`pg_largeobject`/`lo`) | Melhor para arquivos muito grandes e streaming; dados fora da linha | Gestão complexa (truncate, permissões), checksum manual, manutenção de blobs órfãos; impõe uso de `lo_*` | Reservada como evolução futura para arquivos muito grandes |
| Storage externo (filesystem/S3) | Escala independente do banco | Exige gerenciamento separado, inconsistência de backup, permissões e presigned URLs | Rejeitada para anexos (decisão de produto); permanece para releases/executáveis (§17) |

Decisão:

- **Anexos**: BYTEA em tabela dedicada com limite de tamanho configurável (recomendação inicial: 10 MB por arquivo). O PostgreSQL é a única fonte de verdade.
- **Releases/executáveis**: continuam na porta `ArtifactStorage` (filesystem dev / S3 em produção), por serem artefatos grandes e de distribuição.
- Se no futuro arquivos muito grandes forem exigidos para anexos, migrar a coluna `bytea` para Large Objects — sem alterar os metadados de `attachments`.

## 18. Autenticação JWT

Fluxo:

```text
Login
  ↓
validate credentials
  ↓
issue access token
  ↓
issue refresh token
```

**Implementação (M4):**

- Módulo `auth` com portas `TokenService` e `RefreshTokenRepository` (o domínio não conhece `jose` nem Drizzle).
- Use cases `Login`, `RefreshToken` e `Logout` em `application/use-cases`.
- `JoseTokenService` (`infrastructure/security`) — assina e verifica tokens HS256 via `jose`; segredos e TTLs vindos de env.
- Tabela `refresh_tokens` (`infrastructure/database/schema.ts`, migration `0001`): `token_hash` (SHA-256 do token, nunca o token em si), `user_id`, `expires_at`, `revoked_at`, `replaced_by_id`, `created_at`.
- `createAuthenticateHook` (`infrastructure/http/authenticate.ts`) valida `Authorization: Bearer <access token>` e injeta `request.auth = { userId }`; sem token válido → 401 `UNAUTHORIZED`.
- Endpoints: `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`.

Access token:

- curta duração (default `15m`);
- contém apenas `sub` (userId) — claims mínimas.

Refresh token:

- rotação: cada uso emite um novo par e revoga o anterior (`replaced_by_id` registra a substituição);
- revogável no logout;
- não usar como autorização de API;
- persistido apenas como hash (SHA-256), nunca em texto puro.

Evitar colocar permissões gigantes dentro do JWT.

Permissões podem ser resolvidas pelo contexto/membership (M5).

### Configuração (env)

```text
JWT_ACCESS_SECRET=   # obrigatório, mínimo 32 caracteres
JWT_REFRESH_SECRET=  # obrigatório, mínimo 32 caracteres
JWT_ACCESS_TTL=      # default 15m
JWT_REFRESH_TTL=     # default 30d
```

Em `NODE_ENV=production`, os segredos de desenvolvimento padrão são rejeitados.

## 19. Autorização

Usar permissões explícitas.

Exemplo:

```text
requisitions.read
requisitions.create
requisitions.update
requisitions.delete

tasks.read
tasks.create
tasks.update
tasks.delete
tasks.move

kanban.manage
timeline.manage

systems.manage
versions.manage
releases.manage

users.manage
permissions.manage

notifications.manage
chat.use
audit.read
```

A lista deve evoluir com os use cases.

### 19.1 Modelo implementado (M5)

A autorização é baseada em permissões e resolvida por requisição:

- `Permission` (lista inicial em `API/src/modules/permissions/domain/permission.ts`), com guard `isPermission` e `toPermissions`.
- `AuthenticatedUser` (`shared/application/authenticated-user.ts`): `{ userId, companyId, permissions }` — o contexto que as rotas resolvem e os use cases validam.
- `PermissionResolver` (porta em `application/ports`) produz o `AuthenticatedUser` a partir de `(userId, companyId)`; implementação `MembershipPermissionResolver`:
  1. membership ativa do usuário na empresa (senão → `ForbiddenError`);
  2. base = permissões explícitas de `memberships.permissions` (jsonb, migration `0002`); se vazia, usa o preset do cargo (`ROLE_PERMISSIONS`) como **default de resolução** — o cargo (§11.1) continua sendo atributo de RH e não acopla permissões fixas;
  3. soma as permissões de dashboard da `DashboardPolicy` (sem duplicar).
- `AuthorizationService` (`assertPermission` → `ForbiddenError` 403; `assertCompanyContext`): cada use case protegido recebe o `AuthenticatedUser` e valida a permissão exigida (ex.: `company.read`, `company.update`, `users.manage`), além de conferir que `actor.companyId === companyId` (nunca confiar em `companyId` do cliente).
- `DashboardPolicy` (`domain/dashboard-policy.ts`): política do Kanban/timeline (§11) com padrão da empresa (`companyDefault`), por função (`rolePermissions`), por usuário (`userPermissions`/`userDenied`) e `allowPersonalKanbanManagement`; `canManageBoard(role, userId, scope)` distingue quadro da empresa (`company`) do quadro próprio (`own`) — o funcionário gerencia o próprio quadro sem alterar o global.
- As permissões são resolvidas por requisição a partir do repositório (sem cache por enquanto).

## 20. Notificações

Modelo:

```text
NotificationPreference
├── userId
├── eventType
├── inAppEnabled
├── emailEnabled
└── ...
```

```text
Notification
├── id
├── companyId
├── userId
├── type
├── title
├── body
├── readAt
├── data
└── createdAt
```

Arquitetura:

```text
Use Case
   ↓
Domain/Application Event
   ↓
Notification Handler
   ↓
Preference Resolver
   ↓
Notification persistence
   ↓
Delivery
```

Isso evita acoplar notificações às regras centrais.

## 21. Chat

### Persistência

```text
Conversation
├── id
├── companyId
├── type
├── createdAt
└── updatedAt
```

```text
ConversationMember
├── conversationId
└── userId
```

```text
Message
├── id
├── conversationId
├── senderId
├── body
├── createdAt
└── editedAt?
```

### Tempo real

```text
Browser
  ⇅ WebSocket
Fastify
  ⇅
Message Application Service
  ↓
PostgreSQL
```

Para múltiplas instâncias:

```text
Fastify instance A ─┐
Fastify instance B ─┼─ Redis Pub/Sub
Fastify instance C ─┘
```

Redis é transporte de eventos em tempo real, não fonte de verdade.

## 22. Redis

Usar somente quando houver benefício.

Casos válidos:

- cache;
- pub/sub;
- rate limiting distribuído;
- presença;
- filas.

Evitar cachear regras críticas de autorização sem estratégia clara de invalidação.

## 23. Frontend

### Estrutura

```text
app/src/
├── app/
│   ├── router/
│   ├── providers/
│   └── layouts/
├── components/
│   ├── ui/
│   └── common/
├── features/
│   ├── auth/
│   ├── requisitions/
│   ├── tasks/
│   ├── kanban/
│   ├── timeline/
│   ├── capacity/
│   ├── systems/
│   ├── employees/
│   ├── notifications/
│   └── chat/
├── pages/
├── domain/
├── services/
├── hooks/
├── lib/
└── types/
```

### 23.1 Responsividade, visual e tema

Requisitos imprescindíveis do frontend:

- **Mobile-first e totalmente responsivo**: todas as telas (Kanban, timelines, formulários, relatórios, chat) devem funcionar em aparelhos móveis sem degradação funcional.
- **Visual elegante e tecnológico**: consistência por design system (shadcn/ui) e tokens de tema (Tailwind) — cores, cor de destaque, tipografia, espaçamento e densidade definidos como tokens, não estilos soltos.
- **Personalização total por usuário**: tema claro/escuro, cor de destaque e densidade configuráveis e persistidas por usuário, para acompanhar o usuário entre dispositivos.

Regras estruturais:

- temas/cores são **responsabilidade da apresentação**; o domínio não conhece CSS nem nomes de cores (ver §17 e §42);
- preferências de aparência são **estado de preferência do usuário**, não regra de negócio (ver §26);
- o mapeamento de conceitos de domínio para estilos (ex.: `HIGH` → vermelho) é feito na camada visual;
- a persistência das preferências deve permitir evolução (inicialmente por usuário via API quando a identidade existir).

## 23.2 Documentação da API (Scalar)

**Todo e qualquer endpoint da API deve ser documentado.**

Stack:

- `@fastify/swagger` — gera o documento OpenAPI a partir dos schemas registrados nas rotas;
- `@scalar/fastify-api-reference` — serve a UI de documentação (Scalar).

Endpoints:

```text
GET /reference                   → UI interativa da API
GET /reference/openapi.json      → spec OpenAPI (JSON)
GET /reference/openapi.yaml      → spec OpenAPI (YAML)
```

Regras:

- cada rota deve definir `schema` (tags, descrição, parâmetros, body, responses) no registro;
- o documento OpenAPI é derivado dos schemas, então rota sem schema não é documentada;
- a documentação é atualizada automaticamente ao registrar novas rotas;
- testes devem validar que o documento OpenAPI contém as rotas esperadas.

## 24. Feature architecture

Exemplo:

```text
features/requisitions/
├── components/
├── hooks/
├── api/
├── schemas/
├── types/
└── index.ts
```

A feature pode chamar application/domain functions.

A UI não deve reproduzir a regra de cálculo de capacidade.

## 25. API client

Criar um client centralizado.

Responsabilidades:

- base URL;
- headers;
- access token;
- refresh;
- tratamento de erro;
- serialização.

Não espalhar `fetch` pelo projeto.

## 26. Estado

Separar:

### Server state

Dados vindos da API.

### UI state

Modal aberto, filtros, seleção etc.

### Form state

Campos de formulário.

### Auth state

Identidade e contexto atual.

### Theme / preferences state

Preferências de aparência do usuário (tema claro/escuro, cor de destaque, densidade).

Persistidas por usuário; são preferências, não regra de negócio.

Evitar um Context global contendo todas as entidades.

## 27. Kanban no frontend

O Kanban deve:

- mostrar quatro colunas;
- permitir drag and drop;
- usar ações rápidas;
- atualizar o backend;
- lidar com optimistic update apenas quando houver estratégia de rollback;
- respeitar permissões;
- atualizar timeline quando o status mudar.

A especificação exige que o usuário consiga mover cards e iniciar/pausar com ações rápidas. fileciteturn0file0L41-L50

## 28. Timeline no frontend

### Semanal

Grid:

```text
                 Seg Ter Qua Qui Sex
Tarefa A          █████
Tarefa B              ███████
Tarefa C                    ███
```

### Mensal

Eixo diário.

### Anual

Eixo mensal.

A camada visual recebe dados já normalizados para apresentação.

## 29. API e contratos

Os contratos de entrada/saída devem ser explícitos.

Exemplo:

```text
CreateRequisitionInput
CreateRequisitionOutput
UpdateRequisitionInput
ListRequisitionsQuery
```

Zod pode ser usado no boundary HTTP.

Não transportar entidades de domínio diretamente como JSON de API.

Criar DTOs/mappers.

## 30. Transações

Usar transações para operações que precisam de atomicidade.

Exemplo:

```text
CompleteTask
  ├── update task
  ├── create status history
  ├── close active pause if applicable
  ├── create domain event
  └── commit
```

Não fazer cinco queries independentes quando uma operação exige consistência.

## 31. Concorrência

Operações sensíveis devem considerar concorrência.

Exemplos:

- duas pessoas movendo a mesma tarefa;
- duas pessoas concluindo a mesma requisição;
- atualização simultânea;
- publicação de release.

Usar:

- constraints;
- transações;
- optimistic concurrency quando necessário;
- version columns quando necessário.

## 32. Auditoria

```text
AuditLog
├── id
├── companyId
├── actorUserId
├── action
├── entityType
├── entityId
├── metadata
└── createdAt
```

Auditoria não deve armazenar dados sensíveis desnecessários.

## 33. Observabilidade

Desde o início:

- logs estruturados;
- request id;
- erro estruturado;
- duração de requests;
- health check.

Depois:

- métricas;
- tracing;
- alertas.

### 33.1 Erros e envelope de resposta

Erros de domínio/aplicação são classes tipadas em `API/src/shared/errors` (`AppError` + `NotFoundError`, `UnauthorizedError`, `ForbiddenError`, `ValidationError`, `ConflictError`, `BusinessRuleError`), cada uma com `code` e `statusCode`.

Toda resposta de erro usa o envelope:

```json
{ "error": { "code": "NOT_FOUND", "message": "...", "details": {} } }
```

`details` é opcional. O error handler global do Fastify (`API/src/infrastructure/http/error-handler.ts`) traduz: `AppError` → seu status; `ZodError` e validações de schema → 400 `VALIDATION_ERROR` com issues; erros desconhecidos → 500 `INTERNAL_ERROR`. Em produção, a mensagem de erros internos é oculta (o stack vai apenas para o log). Rota inexistente usa o mesmo envelope via `setNotFoundHandler` (404 `NOT_FOUND`).

## 34. Configuração

`API/.env`:

```text
NODE_ENV=
PORT=
LOG_LEVEL=
DATABASE_URL=
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
JWT_ACCESS_TTL=    # opcional, default 15m
JWT_REFRESH_TTL=   # opcional, default 30d
REDIS_URL=
STORAGE_PROVIDER=
STORAGE_BUCKET=
```

`app/.env`:

```text
VITE_API_URL=
```

Segredos nunca entram no Git.

Criar `.env.example`.

## 35. Deploy

A arquitetura deve funcionar em:

```text
Browser
   ↓
Reverse Proxy
   ↓
App/API
   ↓
PostgreSQL
   ↓
Redis opcional
   ↓
Object Storage
```

O `Object Storage` serve exclusivamente aos executáveis de releases (§17).

Anexos de requisições/tarefas não exigem storage externo: os binários vivem no PostgreSQL (BYTEA, §17.1/§17.2).

A API deve ser stateless sempre que possível.

Isso permite múltiplas instâncias.

## 36. Migrations

Drizzle migrations devem ser versionadas.

Fluxo:

```text
alter schema
   ↓
generate migration
   ↓
review migration
   ↓
run migration
```

Não editar banco de produção manualmente como prática normal.

## 37. Estratégia de testes

### Unit

Domínio puro:

- capacidade;
- calendário;
- prioridades;
- transições;
- regras.

### Integration

- repositories;
- PostgreSQL;
- migrations;
- autorização;
- isolamento tenant.

### API

- login;
- CRUD;
- permissões;
- filtros;
- conflitos.

### Frontend

- forms;
- filtros;
- Kanban;
- timeline;
- estados.

### Cobertura obrigatória

A API e o app devem possuir cobertura de testes obrigatória, com a meta de se aproximar de **100% do código**:

- `vitest` + `@vitest/coverage-v8` em `API/` e `app/`;
- `npm run test:coverage` em cada aplicação;
- thresholds definidos no `vitest.config.ts` de cada aplicação (~95% statements/lines/functions, ~90% branches);
- o código novo deve vir acompanhado de testes; funcionalidade não é concluída com cobertura abaixo dos thresholds;
- relatório de cobertura em `coverage/` (ignorado pelo Git).

## 38. Primeira versão do schema

Não criar o schema inteiro antes dos use cases.

Ordem:

```text
users / companies / memberships
        ↓
systems / versions / releases
        ↓
requisitions
        ↓
tasks / histories / pauses / time_entries
        ↓
notifications
        ↓
chat
        ↓
audit
```

## 39. Evolução arquitetural

Não implementar:

- microsserviços;
- event sourcing completo;
- CQRS completo;
- Kubernetes;
- filas distribuídas;
- Redis em toda consulta;

sem necessidade concreta.

A arquitetura deve ser modular, não excessivamente distribuída.

## 40. Regras funcionais herdadas da solicitação

### Kanban

Quatro estados:

- A Fazer;
- Em Andamento;
- Pausado;
- Concluído.

Ações:

- iniciar;
- pausar;
- retomar;
- concluir;
- arrastar;
- editar;
- pesquisar. fileciteturn0file0L37-L50

### Pausas

Registrar início e fim da pausa e calcular tempo pausado. fileciteturn0file0L59-L65

### Relatório

Colunas:

- status;
- prioridade;
- título;
- data de emissão;
- data de entrega.

Filtros por:

- período;
- requisição;
- funcionário. fileciteturn0file0L67-L67

### Timeline mensal/anual

Mostrar:

- título;
- número;
- prioridade;
- horas;
- início;
- previsão;
- entrega real;
- atrasos;
- filtros;
- indicadores. fileciteturn0file0L70-L94

## 41. Decisão importante sobre "dashboard de tarefas"

A especificação chama a funcionalidade de "Dashboard de Tarefas".

No domínio novo:

```text
Dashboard
    ├── Kanban de Tasks
    └── Timeline de Tasks
```

A requisição é uma entidade relacionada, não necessariamente o próprio card.

Isso permite que uma requisição tenha múltiplas tarefas.

## 42. Regra de implementação

Sempre que houver duas formas possíveis de implementar uma regra:

1. escolher a que mantém o domínio independente;
2. escolher a que preserva isolamento multiempresa;
3. escolher a que é mais fácil de testar;
4. escolher a que reduz acoplamento;
5. somente depois considerar conveniência.

