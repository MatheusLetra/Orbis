# AI Handoff — Orbis

## Projeto

Orbis é uma aplicação multiempresa de gestão de requisições e tarefas.

- API independente em TypeScript/Node.js.
- Fastify, PostgreSQL, Drizzle ORM, Zod, JWT e OpenAPI/Scalar.
- Arquitetura modular com separação entre apresentação, aplicação, domínio e infraestrutura.

## Regras de continuidade

- Ler o Prompt Mestre e este arquivo antes de trabalhar.
- Não reauditar M09, M10, o hardening concorrente, M11.2A ou M11.2B sem evidência concreta de regressão.
- Não assumir decisões abertas.
- Não introduzir Board, KanbanColumn, TaskPosition, ordering persistido, reorder, WIP, swimlanes, realtime ou WebSocket para M11 sem requisito novo.
- `commands/code_assist_agent.md` é um arquivo preexistente não relacionado à M11; não modificá-lo sem motivo concreto.

## Estado das milestones

- M09 — Tasks: **concluída**.
- M10 — Attachments: **concluída**.
- Correção pré-M11 de `LocalArtifactStorage`: **concluída**.
- M11 — Kanban: **em andamento**.
- M12 em diante: não iniciadas.

## M09 — Tasks

Não reabrir sem regressão comprovada. Preservar:

- statuses `TODO`, `IN_PROGRESS`, `PAUSED`, `DONE`;
- matriz oficial de transições;
- `PAUSED → DONE` proibida;
- `DONE` terminal;
- `completedAt` controlado pelo domínio;
- histórico append-only e evento inicial `null → TODO`;
- UoW, `SELECT ... FOR UPDATE`, atomicidade;
- tenant isolation e autorização.

## M10 — Attachments

Não reabrir sem regressão comprovada. Preservar:

- owners Requisition/Task;
- FILE/LINK;
- metadata separada de `attachment_blobs`/BYTEA;
- download separado;
- attachments carregados sob demanda no detalhe;
- Kanban sem metadata de anexos ou BYTEA na listagem.

## M11 concluído até aqui

### Hardening concorrente

`UpdateTask` usa `TaskUnitOfWork`, carrega com `findByIdForUpdate`, aplica apenas campos permitidos e persiste na mesma transação. `TransitionTaskStatus` continua autoridade exclusiva do status.

Teste PostgreSQL real da corrida edição/transição confirmou que uma edição stale não regrava `DONE`, `completedAt` ou o histórico.

Validação relatada para a suíte de Tasks após o hardening: 113 passed, 0 failed, 0 skipped com PostgreSQL real.

### M11.2A — Projeção, escopo de leitura e pesquisa

Concluída.

`GET /companies/:companyId/tasks` agora suporta:

- `scope=company|own`, default `company`;
- `scope=own` restringido no backend a `assigneeId === actor.userId`;
- rejeição HTTP 400 para `scope=own` com outro `assigneeId`;
- `search` somente em `Task.title`;
- substring case-insensitive, trim, vazio como ausência e máximo de 200 caracteres;
- `%` e `_` literais;
- combinação AND com os filtros existentes;
- ordenação `createdAt ASC, id ASC`;
- `TaskCardOutput` com summaries de assignee e Requisition.

Os comandos/detalhe continuam com seus contratos anteriores. A listagem não carrega histórico, Attachments ou BYTEA. A resolução é feita em uma query tenant-aware, sem N+1.

Validação:

- Tasks sem PostgreSQL: 103 passed, 0 failed, 13 skipped.
- Tasks com PostgreSQL real: 116 passed, 0 failed, 0 skipped.
- typecheck, lint, API build e `git diff --check`: aprovados.
- nenhuma migration ou índice criado.

### M11.2B — Lookups

Concluída.

Responsáveis:

- `GET /companies/:companyId/members` no módulo de Memberships;
- permissão `users.read`;
- somente memberships ativas do tenant;
- saída mínima `{ userId, name }`;
- pesquisa por nome, substring case-insensitive, trim, máximo de 200, `%` e `_` literais;
- query única com `INNER JOIN memberships + users`.

Requisitions:

- `GET /companies/:companyId/requisitions` foi estendida com `search`;
- texto pesquisa `title` por substring case-insensitive;
- termo numérico pesquisa `title` ou `number`;
- trim, vazio como ausência, máximo de 200 e escaping literal;
- filtros e tenant isolation preservados.

Nenhum autofill de Task foi implementado. `CreateTask` e `UpdateTask` continuam validando assignee e Requisition no backend.

Validação:

- Memberships/Requisitions sem PostgreSQL: 150 passed, 0 failed, 24 skipped.
- HTTP/OpenAPI: 19 passed, 0 failed, 0 skipped.
- Memberships/Requisitions com PostgreSQL real: 174 passed, 0 failed, 0 skipped.
- typecheck, lint, API build e `git diff --check`: aprovados.
- nenhuma migration, índice ou dependência nova.

## Contrato mínimo do Kanban

- Uma Task = um card.
- Colunas: `TODO`, `IN_PROGRESS`, `PAUSED`, `DONE`, nessa ordem.
- Drag e ações rápidas reutilizam `PATCH /companies/:companyId/tasks/:taskId/status`.
- Criação reutiliza `POST /companies/:companyId/tasks`.
- Edição reutiliza `PATCH /companies/:companyId/tasks/:taskId`.
- Detalhe reutiliza `GET /companies/:companyId/tasks/:taskId`.
- Attachments do detalhe usam as rotas existentes sob demanda.
- Não existe reorder persistido.

## Decisões abertas

### Primeira decisão da próxima sessão: sessão frontend

Escolher o contrato de persistência/transporte da sessão frontend antes de `M11.3A`.

Opções:

1. memória ou `sessionStorage`: menor alteração backend, mas sessão pode ser perdida no reload ou manter token acessível ao JavaScript;
2. `localStorage`: persistente, mas deixa refresh token persistentemente acessível ao JavaScript;
3. refresh token em cookie `HttpOnly`: exige alteração coordenada de API/frontend e análise de CORS/CSRF.

Recomendação atual: **opção 3, cookie `HttpOnly`**, mas isso é recomendação, não decisão aprovada.

### Customização das colunas

Ainda não decidido se usuários autorizados poderão alterar somente label/ordem ou também visibilidade/aparência, nem se a configuração será da empresa ou também pessoal.

Limites já derivados: quatro statuses permanecem fixos, sem novos workflows.

Recomendação atual: configuração por empresa somente de label e ordem, com quatro colunas sempre visíveis e permissão `kanban.manage`.

### Mutações `own/company`

O escopo de leitura está implementado; a autorização de criação, edição, transição e reatribuição ainda está aberta.

Recomendação atual: manter permissões operacionais (`tasks.create/update`), restringir own por `assigneeId === actor.userId`, impedir reatribuição em own-only e exigir capacidade global para Tasks alheias. Não tratar como decisão aprovada.

### Autofill de Requisition

Ainda não decidido quais campos devem ser sugeridos ao selecionar uma Requisition. O lookup apenas disponibiliza a seleção; não copiar título, prioridade, descrição, datas ou responsável automaticamente.

## Próxima unidade

`M11.3A — Auth, HTTP e empresa ativa`.

Antes de implementá-la:

1. ler o Prompt Mestre;
2. ler este `docs/ai_handoff.md`;
3. não reauditar M09/M10/hardening/M11.2A/M11.2B sem evidência;
4. decidir o contrato de persistência/transporte da sessão frontend;
5. após a decisão, gerar o BUILD de M11.3A.

## Riscos relevantes

- escolher sessão frontend sem resolver refresh token e segurança;
- tratar permissões own/company somente na UI;
- implementar customização antes de definir ownership;
- introduzir N+1 ao integrar selectors/cards;
- oferecer drag para transições proibidas pela M09;
- carregar BYTEA no board.

## Estado do frontend

O frontend ainda deve ser revalidado na próxima sessão. O último estado conhecido tinha shell/tema parciais, sem routing, autenticação, empresa ativa, HTTP client, cache, forms, Kanban ou DnD. Não assumir que esse estado não mudou.

## Próximo passo operacional

A próxima sessão deve começar pela decisão da sessão frontend. Nenhuma funcionalidade deve ser implementada nesta troca de sessão antes dessa decisão.
