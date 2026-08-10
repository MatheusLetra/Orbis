# Plano de Implementação — Orbis

## 1. Objetivo deste documento

Este plano organiza o desenvolvimento do Orbis **do zero** em etapas modulares, para que possam ser executadas:

- uma por vez;
- sem pressa;
- com critérios claros de conclusão;
- de forma que seja fácil retomar o trabalho depois de qualquer pausa.

Fontes consultadas:

- `docs/AGENTS.md` — regras e ordem recomendada.
- `docs/ai_context.md` — contexto e stack.
- `docs/architecture.md` — arquitetura detalhada e decisões estruturais.
- `docs/ai_handoff.md` — estado atual e milestones iniciais.

Regra transversal: qualquer dúvida de negócio não resolvida deve ser registrada em `docs/ai_handoff.md` (seção "Questões ainda abertas") ou levada a decisão, **nunca inventada silenciosamente**.

---

## 2. Como usar este plano

### 2.1 Convenções

Cada módulo (etapa) possui:

- **Objetivo** — o que será entregue.
- **Pré-requisitos** — módulos que devem estar concluídos antes.
- **Escopo (passos)** — lista concreta, em ordem.
- **Critérios de conclusão** — o que define "etapa fechada".
- **Verificação** — como validar.
- **Pontos de atenção** — armadilhas e decisões que exigem cuidado.

### 2.2 Regras para executar um módulo

1. Ler `docs/AGENTS.md`, `docs/ai_context.md`, `docs/architecture.md` e `docs/ai_handoff.md`.
2. Marcar o módulo como "em andamento" em uma seção própria (`docs/ai_handoff.md`) ou em TODO list.
3. Implementar somente o escopo do módulo.
4. Rodar as verificações indicadas.
5. Somente marcar como concluído quando **todos** os critérios de conclusão forem atendidos.
6. Somente então avançar para o próximo módulo.

### 2.3 Ordem

Os módulos são ordenados preservando dependências. Não adiantar módulos que dependem de fundações ainda instáveis (ex.: timeline mensal/anual depende de capacidade e calendário estáveis).

---

## 3. Mapa geral dos módulos

```text
M0  Fundação dos projetos (API + app, design system, tema e base responsiva)  [base de tudo]
M1  Infraestrutura de dados (PostgreSQL/Drizzle/migrations/schema base)
M2  Núcleo compartilhado (config, erros, logging, health, env)
M3  Identidade: companies / users / memberships
M4  Autenticação (JWT, login, refresh, logout)
M5  Autorização por permissões
M6  Catálogo de software: systems / versions / releases / storage
M7  Requisições
M8  Tarefas + histórico de status
M8.5 Anexos de requisições e tarefas (imagens, PDFs e links externos)
M9  Kanban (UI)
M10 Pausas e apontamento de horas
M11 Capacidade e previsão (domínio puro)
M12 Timeline semanal
M13 Timeline mensal/anual
M14 Notificações
M15 Chat
M16 Relatórios
M17 Auditoria
M18 Hardening, observabilidade e deploy
```

Etapas `M12` e `M13` dependem de `M9`/`M11` estarem confiáveis.

`M8.5` (anexos) deve ser executado logo após `M8`, antes do Kanban (`M9`), porque a UI do card exibe anexos.

### 2.4 Requisito transversal: responsividade, visual e tema

É uma regra imprescindível e se aplica a **todas** as etapas com interface:

1. **Totalmente responsivo em mobile (mobile-first)** — Kanban, timelines, formulários, relatórios e chat devem funcionar em aparelhos móveis sem degradação funcional.
2. **Visual elegante e tecnológico** — consistência via design system (shadcn/ui) e tokens de tema (Tailwind), sem estilos soltos por feature.
3. **Personalização total por usuário** — tema claro/escuro, cor de destaque e densidade visual configuráveis por usuário e persistidas por usuário.

Regras estruturais:

- tema, cores e responsividade pertencem à camada de apresentação; o domínio não conhece CSS ou nomes de cores;
- mapeamentos domínio → estilo (ex.: `HIGH` → vermelho) acontecem apenas na UI;
- as preferências de aparência são estado de preferência do usuário, não regra de negócio;
- a base do tema é criada no M0 e reutilizada em todos os módulos de UI;
- nenhum módulo de UI pode ser considerado concluído sem validar mobile + tema.

---

## 4. Módulos

### M0 — Fundação dos projetos (API + app)

**Objetivo:** criar a estrutura inicial das duas aplicações independentes e um repositório que sobe localmente.

**Pré-requisitos:** nenhum.

**Escopo (passos):**

1. Criar estrutura de pastas `API/` e `app/` conforme `docs/architecture.md §4`.
2. `API`:
   - `package.json`, `tsconfig.json` (strict);
   - Fastify configurado;
   - `src/main.ts` e `src/app.ts` separados (bootstrap vs. construção da aplicação);
   - rota `/health`;
   - documentação de API via **Scalar** (`@scalar/fastify-api-reference`) + `@fastify/swagger` (`GET /reference`);
   - cobertura de testes com `vitest` + `@vitest/coverage-v8` (`npm run test:coverage`).
3. `app`:
   - Vite + React + TypeScript (strict);
   - shadcn/ui inicializado;
   - Tailwind configurado;
   - shell da aplicação carregando no navegador;
   - cobertura de testes com `vitest` + `@vitest/coverage-v8` (`npm run test:coverage`).
4. Git init (se ainda não existir) + `.gitignore` cobrindo `node_modules`, `.env`, `dist`, `coverage`.
5. Scripts de desenvolvimento e build em cada `package.json`.
6. Base do design system e tema (no `app`):
   - tokens visuais no Tailwind: cores base, cor de destaque, tipografia, espaçamento, densidade, temas claro/escuro;
   - shadcn/ui configurado para alternar tema claro/escuro;
   - mecanismo de persistência de preferências de aparência por usuário (decisão registrada no handoff — questão 8);
   - fallback temporário em armazenamento local até a identidade existir (M3/M4).
7. Base responsiva:
   - viewport mobile (meta viewport) e layout do shell adaptável;
   - validação do shell em viewport pequena já nesta etapa.

**Critérios de conclusão:**

- `npm install` funciona em `API/` e `app/`.
- `API` sobe e responde `GET /health`.
- Documentação da API acessível em `GET /reference` (Scalar).
- `app` abre no navegador sem erros.
- TypeScript strict habilitado em ambos.
- Shell responsivo em viewport mobile (sem quebra de layout).
- Tema claro/escuro alterna e a escolha de aparência é persistida por usuário (via mecanismo definido).
- Visual elegante e tecnológico proveniente dos tokens, sem depender de regra de negócio.
- Cobertura de testes configurada e acima dos thresholds em ambas as aplicações.
- Nenhum secret committado.

**Verificação:**

- `npm run dev` em cada pasta.
- `npm run build` passa em ambas.

**Pontos de atenção:**

- Não criar workspace/monorepo compartilhado agora.
- Manter `API` e `app` totalmente independentes em dependências.

---

### M1 — Infraestrutura de dados (PostgreSQL + Drizzle + migrations + schema base) — ✅ CONCLUÍDO

**Objetivo:** conectar o banco à infraestrutura e criar o uso de migrations versionadas.

**Status da implementação (M1):** conexão Drizzle criada em `API/src/infrastructure/database` (`client.ts`, `schema.ts`, `health.ts`); `drizzle.config.ts` e scripts `db:generate`/`db:migrate`/`db:studio`; migration `0000_eminent_wolfpack.sql` com as 20 tabelas, aplicada e validada em PostgreSQL 17 local (Docker) — FKs com cascade/restrict/set null, índices compostos `(company_id, ...)`, check constraint de anexos, bytea via `customType` (workaround do bug #5184 do drizzle-orm@0.45). `GET /health` inclui status do banco. Enums provisórios registrados no handoff (questão 9). Cobertura de testes em 100%.

**Pré-requisitos:** M0.

**Escopo (passos):**

1. Configurar conexão PostgreSQL (drizzle) apenas em `API/src/infrastructure`.
2. Criar `drizzle.config.ts` e fluxo de geração/aplicação de migrations.
3. Criar a primeira migration contendo o **schema base** (camada inicial — não criar todo o schema de uma vez):
   - `companies`;
   - `users`;
   - `memberships`;
   - `systems`;
   - `system_versions`;
   - `releases`;
   - `requisitions`;
   - `requisition_assignees`;
   - `tasks`;
   - `task_status_history`;
   - `task_pause_intervals`;
   - `time_entries`;
   - `attachments`;
   - `attachment_blobs`;
   - `notification_preferences`;
   - `notifications`;
   - `conversations`;
   - `conversation_members`;
   - `messages`;
   - `audit_logs`.
4. Aplicar convenções de nomenclatura: tabelas em plural `snake_case`, `company_id` em entidades tenant-owned, índices compostos `(company_id, ...)`.

> **Nota:** o schema base já pode ser criado nesta etapa porque segue o modelo conceitual definido em `docs/architecture.md §9`; porém, **campos e constraints finais devem ser derivados dos use cases** ao longo dos módulos seguintes. Evitar inventar colunas sem uso real.

**Critérios de conclusão:**

- Migration gerada, revisada e aplicada em um banco local.
- Conexão validada por uma query simples e um health check de banco.
- Convenções de `company_id` e índices compostos aplicadas.

**Verificação:**

- Rodar migration de cima para baixo em banco limpo.
- Executar `select`/`count` simples confirmando tabelas.

**Pontos de atenção:**

- `infrastructure/` é o único lugar onde Drizzle aparece.
- Não editar banco manualmente em produção como prática normal.

---

### M2 — Núcleo compartilhado (config, erros, logging, env)

**Objetivo:** criar os utilitários transversais que todos os módulos usarão.

**Pré-requisitos:** M0.

**Escopo (passos):**

1. `config/` — leitura e validação de variáveis de ambiente (Zod) com `.env.example`.
2. Tipos de erro compartilhados:
   - `NotFoundError`;
   - `UnauthorizedError`;
   - `ForbiddenError`;
   - `ValidationError`;
   - `ConflictError`;
   - `BusinessRuleError`.
3. `shared/errors` — classe base e um mecanismo para traduzir erros de domínio/aplicação em status HTTP (sem retornar stack trace em produção).
4. `shared/logging` — logger estruturado com `request id`.
5. `shared/application` e `shared/domain` — primitivas base para use cases, entidades e value objects (mínimo necessário).
6. Tratamento global de erros no Fastify.

**Critérios de conclusão:**

- `.env.example` existe em `API/` e `app/`.
- Erros tipados são lançáveis dos use cases e convertidos para HTTP corretamente.
- Logs estruturados contêm `request id`.
- Health check responde mesmo com banco indisponível na API (estado de degradação).

**Verificação:**

- Chamar um endpoint que força um erro tipado e conferir status/body.
- Conferir saída do log.

**Pontos de atenção:**

- Não usar `try/catch` indiscriminado.
- Erros de negócio nunca expõem detalhes internos em produção.

---

### M3 — Identidade: companies / users / memberships

**Objetivo:** criar o modelo de multiempresa e identidade.

**Pré-requisitos:** M1 e M2.

**Escopo (passos):**

1. Módulo `companies`:
   - entidade `Company` (nome, dados cadastrais, settings, timezone);
   - use cases: criar/listar/obter/atualizar empresa.
2. Módulo `users`:
   - entidade `User` (identidade global).
   - cadastro de usuário com hash de senha.
3. `Membership` como vínculo `User ↔ Company`:
   - membro de acesso `companyId`;
   - validação de acesso à empresa;
   - troca de contexto de empresa quando aplicável.
   - perfil de funcionário com **cargo** (posição/função na empresa) — cargos iniciais: `ADMINISTRADOR`, `GESTOR`, `SUPORTE`, `TESTADOR`, `DESENVOLVEDOR`, lista aberta. O cargo é atributo funcional de RH e não substitui o mecanismo de autorização por permissões (M5).
4. Isolamento por `company_id` já nas queries de repositórios tenant-owned.

**Critérios de conclusão:**

- Empresa, usuário e membership persistidos.
- Um usuário consegue acessar apenas empresas em que possui membership (validação via contexto autenticado, não via `companyId` do cliente).
- Testes de isolamento entre duas empresas passam.

**Verificação:**

- Testes de integração com dois tenants: usuário do tenant A não lê dados do tenant B.
- Validação de acesso a membership no backend.

**Pontos de atenção:**

- `companyId` efetivo vem do contexto autenticado, nunca confiar no cliente.
- Decisão pendente: UX de usuário em múltiplas empresas — registrar em `ai_handoff.md` antes de definir comportamento.

---

### M4 — Autenticação (JWT, login, refresh, logout)

**Objetivo:** fluxo de autenticação completo.

**Pré-requisitos:** M3.

**Escopo (passos):**

1. `auth` domain: regras de credencial (hash seguro — senha nunca em texto puro).
2. Use cases:
   - `Login`;
   - `RefreshToken` (com rotação e revogação);
   - `Logout`.
3. Access token curto com claims mínimas (userId, membership atual, sem permissões gigantes).
4. Refresh token revogável, armazenado de forma segura, não usado como autorização de API.
5. Presentação HTTP:
   - `POST /auth/login`;
   - `POST /auth/refresh`;
   - `POST /auth/logout`.
6. Resolver o contexto autenticado: `AuthenticatedUser { userId, companyId, permissions }`.

**Critérios de conclusão:**

- Login gera access + refresh.
- Refresh rotaciona e revoga token antigo.
- Logout revoga o refresh.
- Rotas protegidas recusam request sem token válido.
- Testes cobrem esses fluxos.

**Verificação:**

- Testes de API para login/refresh/logout.
- Chamada a rota protegida sem token retorna 401.

**Pontos de atenção:**

- Nunca logar tokens ou senhas.
- Permissões resolvidas por contexto/membership, não embutidas no JWT.

---

### M5 — Autorização por permissões

**Objetivo:** controle de acesso baseado em permissões explícitas.

**Pré-requisitos:** M3 e M4.

**Escopo (passos):**

1. Modelo de permissões (lista inicial definida em `docs/AGENTS.md §10`).
2. Vínculo de permissões ao membership (roles/policies).
3. Mecanismo de verificação no nível de use case: cada use case recebe `AuthenticatedUser` e valida permissão.
4. Permitir política padrão da empresa + permissões específicas por função/usário para o dashboard (requisito §11 do AGENTS): contemplar a possibilidade de o funcionário gerenciar o próprio quadro sem poder alterar o quadro global.
5. Aplicar verificação no backend mesmo que a UI esconda ações não permitidas.

**Critérios de conclusão:**

- Permissões resolvidas e verificadas em cada use case protegido.
- Testes de permissão: usuário sem permissão recebe `ForbiddenError`/403.
- Regras de dashboard (empresa x funcional) modeladas.

**Verificação:**

- Testes de autorização por módulo.
- Cenário: usuário sem `requisitions.create` não cria requisição via API.

**Pontos de atenção:**

- Permitir predefinições de roles mas manter modelo permission-based.
- Evitar cachear autorização sem estratégia clara.

---

### M6 — Catálogo de software: systems / versions / releases / storage

**Objetivo:** domínio `System → SystemVersion → Release` com storage abstraído.

**Pré-requisitos:** M3, M4 e M5.

**Escopo (passos):**

1. Módulo `systems`:
   - entidade `System` (tenant-owned);
   - CRUD.
2. Módulo `versions`:
   - `SystemVersion` pertencente a um sistema;
   - CRUD.
3. Módulo `releases`:
   - `Release` vinculada a uma versão;
   - metadados (versionLabel, channel, status, artifactName, storageKey, checksum, sizeBytes, publishedAt);
   - use case `PublishRelease`.
4. Porta `ArtifactStorage`:
   - implementação `LocalArtifactStorage` (dev);
   - preparação para `S3ArtifactStorage` (produção, ambiente);
   - artefato físico fica **fora** do PostgreSQL.
5. Escopo da porta: destina-se **apenas a releases/executáveis**. Anexos de requisições/tarefas (`M8.5`) **não** usam esta porta — são armazenados no próprio PostgreSQL (BYTEA em tabela dedicada; ver `docs/architecture.md §17.2`).

**Critérios de conclusão:**

- CRUD de sistemas/versões com isolamento tenant.
- Publicação de release cria metadados e grava artefato no storage local.
- Testes de permissionamento (ex.: `systems.manage`, `releases.manage`).
- `ArtifactStorage` restrita a releases; anexos seguem a decisão de `M8.5` (PostgreSQL).

**Verificação:**

- Publicar release e conferir metadados + arquivo no storage.
- Testes de isolamento entre tenants.

**Pontos de atenção:**

- Decisão pendente sobre storage de produção para releases (filesystem vs S3) — registrar em `ai_handoff.md`.
- Anexos não criam segunda estratégia: eles ficam no PostgreSQL, não em storage externo.

---

### M7 — Requisições

**Objetivo:** CRUD e regras de negócio de requisição.

**Pré-requisitos:** M3–M5 (e M6 se houver vínculo com sistema/versão).

**Escopo (passos):**

1. Entidade `Requisition` (número, título, descrição, prioridade, status, solicitante, responsável, sistema/versão opcionais, `estimatedHours`, datas, histórico).
2. Use cases: `CreateRequisition`, `UpdateRequisition`, `ListRequisitions`, `GetRequisition`, `DeleteRequisition`.
3. `Requisition.assignees` como vínculo equipe.
4. Prioridades `LOW | MEDIUM | HIGH` como value object; cor é apenas apresentação.
5. DTOs/mappers explícitos (`CreateRequisitionInput/Output`, etc.) — não transportar entidade como JSON.
6. Endpoints:
   - `GET/POST /requisitions`;
   - `GET/PATCH/DELETE /requisitions/:id`.

**Critérios de conclusão:**

- CRUD completo com autorização (`requisitions.*`).
- Isolamento tenant validado em todas as leituras.
- `number` como identificador de negócio.
- Testes de validação de entrada.

**Verificação:**

- Testes de API de CRUD + filtros.
- Testes de isolamento e permissão.

**Pontos de atenção:**

- Anexos de requisição (imagens, PDFs e links externos) são implementados no módulo dedicado `M8.5`.

---

### M8 — Tarefas + histórico de status

**Objetivo:** entidade `Task` e transições com histórico imutável.

**Pré-requisitos:** M3–M5, M7 (opcional para tarefa independente).

**Escopo (passos):**

1. Entidade `Task` (title, description, priority, status, assignee, datas, vínculo opcional com requisição).
2. Estados: `TODO`, `IN_PROGRESS`, `PAUSED`, `DONE`.
3. Transições e regras de domínio:
   - `TODO → IN_PROGRESS`;
   - `IN_PROGRESS → PAUSED`;
   - `PAUSED → IN_PROGRESS`;
   - regra para conclusão (decidir explicitamente o caso `PAUSED → DONE` — **não inventar silenciosamente**).
4. `TaskStatusHistory`: registros imutáveis de `fromStatus → toStatus`, `changedBy`, `changedAt`, metadados.
5. Use cases: criar, mover/transicionar, atualizar, listar, obter.

**Critérios de conclusão:**

- Toda mudança de status gera histórico.
- Transições inválidas retornam `BusinessRuleError`.
- `tasks.*` autorizadas corretamente.
- Testes de transições de status cobrem todos os casos.

**Verificação:**

- Testes de domínio (puro) das transições.
- Testes de API de criação/movimentação.

**Pontos de atenção:**

- Histórico nunca é editado.
- Não adicionar estados além dos quatro sem necessidade documentada.

---

### M8.5 — Anexos de requisições e tarefas (imagens, PDFs e links externos)

**Objetivo:** permitir que requisições e tarefas possuam anexos de dois tipos:

- **arquivos** (ex.: imagens, PDFs, documentos) — persistidos **no próprio PostgreSQL** (BYTEA em tabela dedicada);
- **links** (ex.: URLs para documentação externa) — persistidos apenas como metadados no banco.

**Decisão de armazenamento (validada):** os binários dos anexos ficam em uma tabela dedicada `attachment_blobs` com coluna `bytea`. O PostgreSQL move automaticamente valores grandes para fora da linha via TOAST, e a leitura retorna o arquivo no endpoint de download. Alternativa (Large Objects) fica documentada como evolução futura. Ver análise completa em `docs/architecture.md §17.2`.

**Pré-requisitos:** M0/M1 (PostgreSQL + práticas de blobs), M7/M8 (entidades de requisição e tarefa). Não depende do storage de releases (M6).

**Escopo (passos):**

1. Tabela `attachments` (tenant-owned, apenas metadados):
   - `id`, `companyId`, `requisitionId?`, `taskId?` (exatamente um proprietário — check constraint),
   - `kind` (`FILE | LINK`),
   - para arquivo: `fileName`, `mimeType`, `checksum`, `sizeBytes`, `title?`;
   - para link: `url`, `title?`;
   - `createdBy`, `createdAt`.
   - Índices compostos `(companyId, requisitionId)` e `(companyId, taskId)`.
2. Tabela `attachment_blobs` (1:1 com attachment do tipo FILE):
   - `attachmentId` (PK e FK → `attachments.id` com `ON DELETE CASCADE`),
   - `data` (`bytea`).
   - A leitura de listas consulta apenas `attachments` (metadados), sem carregar o blob.
3. Política de arquivos (definir limites em config, não no código espalhado):
   - whitelist de tipos (imagens, PDF, e tipos de documento comuns);
   - limite de tamanho por arquivo (recomendação inicial: até **10 MB** por arquivo — evita `bytea` inteiro em memória) e limite de quantidade por entidade.
4. Use cases e autorização:
   - `AddFileAttachment` (valida tipos/tamanho, grava blob + metadados na mesma transação);
   - `AddLinkAttachment` (apenas validação da URL + metadados);
   - `ListAttachments` (por requisição ou tarefa — sem blobs);
   - `GetFileAttachment` (retorna binário para download/visualização);
   - `RemoveAttachment` (remove metadados + blob — o `ON DELETE CASCADE` garante consistência);
   - permissões: `requisitions.update` / `tasks.update` para adicionar/remover; `requisitions.read` / `tasks.read` para listar e baixar.
5. Endpoints (multipart para arquivos, JSON para links):
   - `POST /requisitions/:id/attachments`, `GET /requisitions/:id/attachments`, `DELETE /requisitions/:id/attachments/:attachmentId`;
   - `GET /requisitions/:id/attachments/:attachmentId/file` (download);
   - `POST /tasks/:id/attachments`, `GET /tasks/:id/attachments`, `DELETE /tasks/:id/attachments/:attachmentId`;
   - `GET /tasks/:id/attachments/:attachmentId/file` (download);
   - sempre validando `companyId` por contexto autenticado e ownership da entidade.
6. Transação: gravar `attachments` + `attachment_blobs` (e exclusão) sempre na mesma transação — atomicidade garantida (ver `docs/architecture.md §30`).
7. Backup/operação: os anexos fazem parte do mesmo backup do PostgreSQL (uma única fonte de verdade; sem dependência de storage externo).

**Critérios de conclusão:**

- Upload de imagem/PDF funciona e grava binário em `attachment_blobs` + metadados em `attachments`.
- Link de documentação externa é salvo com validação de URL.
- Download devolve o arquivo íntegro (checksum conferido).
- Leitura e remoção seguem isolamento tenant e permissões (`requisitions.*` / `tasks.*`).
- Tipos não permitidos e arquivos acima do limite são rejeitados.
- Remover anexo apaga metadados e blob atômicamente.

**Verificação:**

- Testes de API: anexo de arquivo, anexo de link, download com checksum, rejeição de tipo/tamanho.
- Testes de transação: falha ao gravar blob não deixa metadados órfãos (e vice-versa).
- Testes de isolamento: usuário de outro tenant não lê/remove/baixa anexos.
- Teste de exclusão de requisição/tarefa validando cascade dos anexos.

**Pontos de atenção:**

- Listar metadados nunca deve carregar o `bytea` (ler apenas as colunas de `attachments`).
- Não confiar em `fileName`/`mimeType` do cliente: validar no backend.
- Upload exige controle de tamanho máximo (definido aqui); leitura do blob carrega em memória — por isso o limite de tamanho é obrigatório.
- O anexo é um enriquecimento da requisição/tarefa; não altera status nem capacidade.

---

### M9 — Kanban (UI)

**Objetivo:** tela de Kanban com quatro colunas e ações rápidas.

**Pré-requisitos:** M8 (backend), M0 (frontend).

**Escopo (passos):**

1. Feature `kanban` no frontend:
   - quatro colunas padrão (A Fazer, Em Andamento, Pausado, Concluído);
   - colunas editáveis por usuários autorizados (configuração de colunas);
   - cards com prioridade, título, responsável, requisição.
2. Drag and drop para mover entre colunas — chamando o endpoint de transição no backend.
3. Ações rápidas: iniciar, pausar, retomar, concluir.
4. Criação rápida de tarefa (ex.: responsável pré-preenchido, busca de requisição para preencher dados).
5. Pesquisa/filtros no quadro.
6. Optimistic update **somente** com estratégia de rollback.
7. Respeitar permissões: esconder ações não permitidas (autorização continua no backend).
8. Estados de loading/error/empty.
9. No detalhe do card, exibir anexos da tarefa/requisição (imagens, PDFs e links — provenientes de `M8.5`), com visual coerente e em formato mobile.

**Critérios de conclusão:**

- Mover cards atualiza o backend e o histórico.
- Ações rápidas disparam os use cases corretos.
- Colunas customizáveis com regra de autorização definida (empresa x próprio quadro).
- Loading/error/empty tratados.
- Kanban totalmente utilizável em mobile (drag and drop por toque e ações rápidas acessíveis).
- Visual elegante e consistente com o design system e o tema do usuário.
- Anexos (`M8.5`) visíveis e navegáveis no detalhe do card, responsive e no tema do usuário.

**Verificação:**

- Testes frontend dos estados do Kanban.
- Teste manual de drag and drop + conflito de concorrência (duas pessoas no mesmo card).

**Pontos de atenção:**

- Mudanças de status devem refletir também na timeline (integrar com M12).
- Concorrência: duas pessoas movendo o mesmo card — usar optimistic locking/version.

---

### M10 — Pausas e apontamento de horas

**Objetivo:** registros imutáveis de pausas e apontamento de horas reais.

**Pré-requisitos:** M8.

**Escopo (passos):**

1. `TaskPauseInterval`: `startedAt`, `endedAt`, `durationSeconds`.
   - Ao pausar: criado intervalo aberto.
   - Ao retomar: intervalo fechado + duração calculada.
   - Nunca sobrescrever intervalos anteriores.
2. `TimeEntry` separada de estimativa: `userId`, `taskId`, duração, descrição; apontamento manual por duração na primeira versão.
3. Use cases: `PauseTask`, `ResumeTask`, `RegisterTimeEntry`, `CompleteTask` (fechando pausa ativa se aplicável).
4. Transações agrupadas (ex.: `CompleteTask` → update + histórico + close pause + evento — tudo atômico).
5. Endpoints de pause/resume/complete/time-entries.

**Critérios de conclusão:**

- Histórico de pausas imutável e auditável.
- Horas apontadas ≠ estimativa.
- Conclusão de tarefa com pausa aberta tratada explicitamente e com teste.

**Verificação:**

- Testes de domínio para pausa/retomada/duração.
- Testes de integração da transação de conclusão.

**Pontos de atenção:**

- Decisão pendente sobre conclusão com tarefa pausada — definir junto ao handoff.
- Sempre manter `estimatedHours` intocado quando apontar horas.

---

### M11 — Capacidade e previsão (domínio puro)

**Objetivo:** serviço de capacidade e previsão desacoplado de banco/HTTP.

**Pré-requisitos:** M2, M5 (dados de disponibilidade).

**Escopo (passos):**

1. `BusinessCalendar` (abstração pura): saber se dia é útil, avançar N dias úteis, considerar fim de semana e futuramente feriados configuráveis por empresa.
2. `CapacityCalculator` (puro):
   - `dailyCapacity = availableDevelopers × dailyHoursPerDeveloper`;
   - `requiredDays = estimatedHours / dailyCapacity`;
   - `plannedDeliveryDate = addBusinessDays(startDate, requiredDays)`.
   - Arredondamento e regra de inclusão do dia inicial definidos **aqui** e cobertos por testes.
3. Porta de acesso para dados de desenvolvedores/disponibilidade (infraestrutura implementa).
4. Exposição via use case `CalculateCapacity` e endpoint `GET /capacity`.

**Critérios de conclusão:**

- Fórmula implementada em serviço puro testável sem banco.
- Testes unitários: fim de semana, feriado, capacidade zero, arredondamento.
- Previsão calculada no timezone da empresa.

**Verificação:**

- `npm test` dos módulos capacity/calendar.
- Conferir manualmente com casos conhecidos.

**Pontos de atenção:**

- Não alterar a fórmula silenciosamente; evoluções (carga ocupada, férias) devem ser documentadas.
- Nunca colocar calendário/capacidade em SQL ou componentes React.

---

### M12 — Timeline semanal

**Objetivo:** visualização semanal de tarefas posicionadas nos dias úteis.

**Pré-requisitos:** M11 (calendário/previsão), M8/M9 (tarefas + transições).

**Escopo (passos):**

1. Endpoint `GET /timeline/weekly` — normalizar tarefas + datas para apresentação (server side já entrega dados prontos; UI não calcula regra de negócio).
2. Feature `timeline` no frontend:
   - grid semanal: seg–sex com barras/tarefas posicionadas por data;
   - diferenciação visual para tarefa pausada;
   - ordenação.
3. Integração: mudar status no Kanban atualiza a timeline (e vice-versa quando aplicável).
4. Filtros: prioridade, responsável, status, mês/ano quando aplicável.

**Critérios de conclusão:**

- Timeline semanal reflete datas reais/previsão corretamente.
- Tarefa pausada diferenciada visualmente.
- Filtros funcionais.
- Autorização `timeline.manage`/`tasks.read` aplicada no backend.
- Timeline utilizável em mobile (rotação de eixo ou modo de leitura adaptado sem perda de informação).
- Visual consistente com o tema e o design system; indicadores legíveis no tema do usuário.

**Verificação:**

- Testes frontend de renderização/filtros.
- Teste manual: mover card e conferir atualização na timeline.

**Pontos de atenção:**

- A apresentação não deve reproduzir regra de capacidade.

---

### M13 — Timeline mensal/anual

**Objetivo:** dashboards mensal e anual com indicadores.

**Pré-requisitos:** M11 e M12 estáveis. (Conforme especificação, fazer por último.)

**Escopo (passos):**

1. Endpoints `GET /timeline/monthly` e `GET /timeline/yearly`:
   - dados normalizados para apresentação;
   - agregações (quantidade por mês, por prioridade), indicadores (horas planejadas, capacidade usada, % entregue no prazo, atrasos).
2. Feature frontend:
   - mensal: dias do mês, requisições, previsão, atraso, ordenação por data;
   - anual: meses, marcadores, contadores, agrupamento por prioridade, expansão para detalhes.
3. Campos obrigatórios visíveis: título, número da requisição, prioridade, horas, início, previsão, entrega real, atrasos.
4. Filtros: prioridade, responsável, status, mês, ano.

**Critérios de conclusão:**

- Todos os campos e filtros obrigatórios presentes.
- Indicadores corretos e calculados no backend.
- Autorização e isolamento tenant validados.
- Campos/indicadores legíveis em mobile (ex.: tabela colapsa em cards, sem cortar informação).
- Visual elegante e consistente com o tema e o design system do usuário.

**Verificação:**

- Testes de agregação (backend).
- Testes frontend dos filtros e indicadores.

**Pontos de atenção:**

- Não implementar antes de capacidade/calendário estáveis.

---

### M14 — Notificações

**Objetivo:** notificações configuráveis seguidas de eventos.

**Pré-requisitos:** M4/M5 e pelo menos um domínio que gere evento (ex.: requisição/tarefa).

**Escopo (passos):**

1. Modelo:
   - `NotificationPreference` por usuário: eventType, inAppEnabled, emailEnabled...
   - `Notification`: companyId, userId, type, title, body, readAt, data.
2. Camada de publicação de eventos (domain/application events) nos use cases centrais (ex.: `TASK_STATUS_CHANGED`, `REQUISITION_ASSIGNED`, `RELEASE_PUBLISHED`...).
3. `NotificationHandler` → `PreferenceResolver` → persistência → delivery.
4. Use case `UpdateNotificationPreferences`.
5. Endpoints:
   - `GET /notifications`;
   - `PATCH /notification-preferences`.
6. Entrega em tempo real via WebSocket quando aplicável (in-app).

**Critérios de conclusão:**

- Eventos centrais geram notificações respeitando preferências.
- Preferências editáveis e validadas.
- Regra de notificação **fora** de controllers.
- Central de notificações e painel de preferências responsivos em mobile e coerentes com o tema do usuário.

**Verificação:**

- Testes: um evento dispara notificação para quem tem preferência habilitada e não para quem desabilitou.
- UI de notificações com read/unread.

**Pontos de atenção:**

- Decisão pendente: canais iniciais (in-app primeiro) — registrar em handoff.

---

### M15 — Chat

**Objetivo:** chat interno por tenant com tempo real.

**Pré-requisitos:** M14 (WebSocket se compartilhado), M3–M5.

**Escopo (passos):**

1. Persistência:
   - `Conversation`, `ConversationMember`, `Message` (PostgreSQL é fonte de verdade).
2. Acesso: isolar por `companyId`/membership.
3. Use cases: criar conversa, listar conversas, enviar mensagem, listar mensagens, marcar lida.
4. WebSocket para tempo real:
   - `Message Application Service` grava no PostgreSQL e publica no canal;
   - Redis pub/sub **opcional** para múltiplas instâncias (a aplicação deve continuar conceitualmente correta sem Redis).
5. Endpoints:
   - `GET /conversations`;
   - `POST /conversations/:id/messages`;
   - read/unread.

**Critérios de conclusão:**

- Mensagens persistidas e acessíveis somente por membros da conversa do tenant.
- Entrega em tempo real quando o WebSocket estiver ativo.
- Isolamento de tenant validado.
- Interface de conversas responsiva em mobile e coerente com o tema do usuário.

**Verificação:**

- Testes de isolamento (usuário de outro tenant não lê conversas).
- Teste manual de envio em tempo real entre dois navegadores.

**Pontos de atenção:**

- Redis não substitui o banco de mensagens.

---

### M16 — Relatórios

**Objetivo:** relatório de tarefas com filtros.

**Pré-requisitos:** M8, M10, M11.

**Escopo (passos):**

1. Relatório com colunas: status, prioridade, título, data de emissão, data de entrega (conforme especificação).
2. Filtros: período, requisição, funcionário.
3. Exportação (formato simples; sem inventar funcionalidade não pedida).
4. Autorização e isolamento tenant.

**Critérios de conclusão:**

- Colunas e filtros conforme especificação.
- Dados consistentes com estimativa/apontamento (sem misturar conceitos).
- Relatório utilizável em mobile (colunas adaptadas, filtros acessíveis) e coerente com o tema do usuário.

**Verificação:**

- Testes de agregação/filtros.
- Conferência manual com dados conhecidos.

---

### M17 — Auditoria

**Objetivo:** log de auditoria de ações sensíveis.

**Pré-requisitos:** M3–M5 (contexto autenticado).

**Escopo (passos):**

1. `AuditLog`: companyId, actorUserId, action, entityType, entityId, metadata, createdAt.
2. Registrar ações sensíveis:
   - login; alteração de permissões; alteração de empresa;
   - criação/alteração/exclusão de requisição; alteração de status;
   - publicação de release; alteração de configurações.
3. Não armazenar dados sensíveis desnecessários.
4. Endpoint `GET /audit` (perm. `audit.read`) com filtros.

**Critérios de conclusão:**

- Ações críticas gravam auditoria com ator/tenant identificados.
- Nenhum dado sensível armazenado no log.

**Verificação:**

- Testes de auditoria nas ações-chave.
- Conferir que login/status/permissoes geram entradas.

---

### M18 — Hardening, observabilidade e deploy

**Objetivo:** preparar para produção sem endosso de complexidade desnecessária.

**Pré-requisitos:** todos os anteriores.

**Escopo (passos):**

1. Observabilidade: logs estruturados consolidados, `request id`, health check completo (db), medição de duração de requests.
2. Segurança:
   - rate limiting onde necessário;
   - CORS restritivo; headers de segurança;
   - validação de payload; controle de tamanho de upload.
3. Frontend:
   - revisar estados de loading/error/empty;
   - acessibilidade e responsividade;
   - validação mobile em todas as telas (Kanban, timelines, formulários, relatórios, chat);
   - validação dos temas claro/escuro, cor de destaque e densidade nas telas principais.
4. Deploy:
   - Dockerfiles simples para API/app;
   - saúde de deploy (health checks);
   - opcional: RLS PostgreSQL como evolução documentada.
5. Revisar `.env.example` e segredos.

**Critérios de conclusão:**

- API stateless, pronta para múltiplas instâncias.
- Observabilidade mínima funcionando (log estruturado + health).
- Deploy subindo localmente via containers ou processo documentado.

**Verificação:**

- Script de deploy documentado.
- Health check completo.
- Revisão de segurança (lista de verificação).

**Pontos de atenção:**

- Não adicionar Redis/kubernetes/filas sem necessidade concreta.

---

## 5. Dependências entre módulos

```text
M0 ──► M1 ──► M2
              M2 ──► M3 ──► M4 ──► M5 ──► M6
                    M3 ──► M7 ──► M8 ──► M8.5 ──► M9
                              M8 ──► M10
                    M5 ──► M11 ──► M12 ──► M13
                    M4/M5 ──► M14 ──► M15 (WebSocket)
                    M8/M10/M11 ──► M16
                    M3/M4/M5 ──► M17
                    tudo ──► M18
```

---

## 6. Regras de qualidade aplicadas a todo módulo

É o "Definition of Done" do `docs/AGENTS.md §35`, aplicável a cada entrega:

- regra de negócio no lugar correto;
- autorização existe no backend;
- isolamento multiempresa validado;
- validação de entrada existe;
- tratamento de erros existe;
- testes relevantes existem;
- migration existe quando necessário;
- frontend trata loading/error/empty;
- frontend é totalmente responsivo em mobile (mobile-first) na tela entregue;
- visual elegante e tecnológico consistente com o design system;
- personalização de aparência por usuário (tema, cor de destaque, densidade) respeitada na tela entregue;
- sem dependência desnecessária;
- build passa;
- testes passam;
- cobertura de testes atende os thresholds (§6.1);
- endpoints novos/documentados via Scalar (§6.2);
- implementação registrada neste plano (§6.3);
- README na raiz atualizado quando aplicável (§6.4);
- documentação atualizada quando a decisão arquitetural mudou.

Prioridade em conflitos (regra final do AGENTS):

1. segurança;
2. isolamento entre empresas;
3. regra de negócio documentada;
4. arquitetura;
5. conveniência.

---

## 6.1 Cobertura de testes obrigatória

A API e o app devem possuir cobertura de testes obrigatória, com a meta de se aproximar de **100% do código**:

- testes unitários, de integração, de API e de frontend;
- `vitest` + `@vitest/coverage-v8` em `API/` e `app/`;
- `npm run test:coverage` em cada aplicação;
- thresholds definidos no `vitest.config.ts` de cada aplicação (~95% statements/lines/functions, ~90% branches);
- código novo acompanhado de testes; funcionalidade não é concluída com cobertura abaixo dos thresholds.

## 6.2 Documentação da API (Scalar)

**Todo e qualquer endpoint da API deve ser documentado** via `@scalar/fastify-api-reference` + `@fastify/swagger`:

- UI interativa em `GET /reference`;
- spec em `GET /reference/openapi.json` e `GET /reference/openapi.yaml`;
- cada rota deve definir `schema` no registro (tags, descrição, parâmetros, body, responses);
- novos módulos devem manter a documentação atualizada automaticamente pelos schemas.

## 6.3 Registro no plano (processo contínuo)

**Toda e qualquer implementação deve ser registrada neste plano**:

- marcar o módulo como em andamento e, ao concluir, os critérios de conclusão;
- decisões novas ou mudanças de regra refletidas no plano;
- mudanças arquiteturais atualizam `docs/ai_context.md` e `docs/architecture.md`;
- ao final de cada etapa, atualizar `docs/ai_handoff.md` (estado atual / próxima ação).

## 6.4 README na raiz do projeto

**A cada etapa concluída, o `README.md` na raiz deve ser gerado ou atualizado**, contendo:

- explicação do projeto (o que é o Orbis, stack, estrutura de pastas);
- como executar localmente (instalar dependências, subir API, subir o app, banco);
- como rodar testes/cobertura, build e lint;
- acesso à documentação da API (Scalar) e endpoints principais.

---

## 7. Questões de negócio ainda abertas (não inventar)

Registradas em `docs/ai_handoff.md §"Questões ainda abertas"`. Impactam módulos:

| Questão | Impacto | Quando decidir |
|---|---|---|
| Usuário em múltiplas empresas (UX) | M3/M4 | antes de consolidar UX de troca de contexto |
| Conjunto final de roles | M5 | durante M5 |
| Funcionário vs usuário como entity | M3 | antes de M3 (modelo RH) |
| Storage de executáveis em produção | M6 | antes de M6 |
| Canais de notificação iniciais | M14 | antes de M14 |
| Feriados globais vs por empresa | M11 | antes de M11 |
| Conclusão de tarefa pausada | M8/M10 | antes de M8 (regra estrutural) |
| Persistência das preferências de aparência (tema/cor/densidade) | M0, M3 | antes de M3 (modelo de identidade) — usar recomendação da questão 8 do handoff |

Ao iniciar um módulo que depende de alguma decisão aberta, revisar a tabela acima e, se necessário, registrar a decisão no handoff antes de implementar.

---

## 8. Como retomar o trabalho (procedimento)

Quando voltar a este projeto após uma pausa:

1. Ler este plano (`docs/PLANO-IMPLEMENTACAO.md`).
2. Ler `docs/ai_handoff.md` para ver onde parou (estado atual / próxima ação).
3. Ler `docs/AGENTS.md §33` (regras para agentes de IA).
4. Conferir o checklist de conclusão no início do módulo a executar.
5. Executar o módulo conforme o passo a passo.

```
Estado do projeto ⟶ docs/ai_handoff.md (marker de progresso)
Como implementar   ⟶ este plano (módulos e passo a passo)
Regras            ⟶ AGENTS.md e architecture.md
```