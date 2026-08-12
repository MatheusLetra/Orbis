# AI Handoff — Orbis

## Estado atual

**M09 — Tarefas e histórico de status: implementação concluída.**

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

## HTTP

Endpoints concluídos:

- `POST /companies/:companyId/tasks`;
- `GET /companies/:companyId/tasks`;
- `GET /companies/:companyId/tasks/:taskId`;
- `PATCH /companies/:companyId/tasks/:taskId`;
- `PATCH /companies/:companyId/tasks/:taskId/status`.

Não existe rota separada de histórico.

## Verificações

- Testes atuais: **101 passed**, **11 PostgreSQL skipped**.
- Lint aprovado.
- `git diff --check` aprovado.
- Typecheck bloqueado somente pelo erro preexistente em `API/src/infrastructure/composition-root.ts`, relacionado ao módulo ausente `@/modules/releases/infrastructure/storage/local-artifact-storage`.
- Não corrigir `local-artifact-storage` neste contexto.

## Encerramento pendente

- Não há pendência funcional conhecida da M09.
- Ainda é necessário executar os 11 testes PostgreSQL reais.
- Após o PostgreSQL verde, realizar a revisão final da M09.
- Não iniciar a M10 antes desse fechamento.
