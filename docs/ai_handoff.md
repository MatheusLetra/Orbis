# AI Handoff — Orbis

## Estado atual

**M09 — Tarefas e histórico de status: concluída.**

Concluídos:

- domínio `Task`;
- entidade imutável `TaskStatusHistory`;
- `CreateTask`;
- `UpdateTask`;
- `TransitionTaskStatus`;
- `ListTasks`;
- `GetTask`;
- repositories Drizzle de Task e histórico;
- `TaskUnitOfWork` transacional;
- composition root;
- cinco endpoints HTTP de Tasks;
- `TestModules` e fakes.

## Decisões relevantes

- Status inicial da Task: `TODO`.
- A criação gera histórico inicial `null → TODO`.
- Transições válidas: `TODO → IN_PROGRESS`, `IN_PROGRESS → PAUSED`, `PAUSED → IN_PROGRESS` e `IN_PROGRESS → DONE`.
- `PAUSED → DONE` é proibido.
- `DONE` é terminal.
- Status só pode ser alterado por `TransitionTaskStatus`.
- Task e histórico são persistidos atomicamente na mesma Unit of Work.
- Transições usam `SELECT ... FOR UPDATE`.
- Histórico é append-only.
- `GetTask` retorna o histórico completo.
- `ListTasks` não retorna histórico.
- Não existe `DeleteTask` na M09.
- Company context vem do actor autenticado; operações são tenant-aware.
- `PAUSED → DONE` permanece proibido.

## HTTP

Endpoints concluídos:

- `POST /companies/:companyId/tasks`;
- `GET /companies/:companyId/tasks`;
- `GET /companies/:companyId/tasks/:taskId`;
- `PATCH /companies/:companyId/tasks/:taskId`;
- `PATCH /companies/:companyId/tasks/:taskId/status`.

Não existe rota separada de histórico.

## Verificações

- Testes de aplicação/Tasks: **101 passed**.
- Testes PostgreSQL de Tasks: **11 passed**, **0 skipped**.
- Lint aprovado.
- `git diff --check` aprovado.
- Typecheck bloqueado somente pelo erro preexistente em `API/src/infrastructure/composition-root.ts`, relacionado ao módulo ausente `@/modules/releases/infrastructure/storage/local-artifact-storage`.
- Não corrigir `local-artifact-storage` neste contexto.

## Encerramento

- M09 está concluída, sem pendências funcionais.
- PostgreSQL real validou persistência, isolamento tenant, ordenação, commit/rollback transacional e `SELECT ... FOR UPDATE`.
- OpenAPI de Tasks está coerente com os contratos e não documenta campos controlados ou extras.
- O erro preexistente de `local-artifact-storage` permanece fora do escopo e não foi corrigido.
- Próxima milestone do roadmap: M10 — Anexos de requisições e tarefas.
