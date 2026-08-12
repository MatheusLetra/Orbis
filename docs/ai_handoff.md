# AI Handoff — Orbis

## Retomada

Leia o Prompt Mestre, `docs/AGENTS.md` e este arquivo antes de trabalhar. Este handoff descreve o estado pós-M11.5. Não reauditar M09, M10, hardening, M11.2A ou M11.2B sem regressão concreta.

`commands/code_assist_agent.md` e arquivo preexistente fora da M11.

## Estado

- M09 — Tasks: concluida.
- M10 — Attachments: concluida.
- Correcao pre-M11 de `LocalArtifactStorage`: concluida.
- M11 — Kanban: em andamento.
- M12 em diante: nao iniciadas.

Concluidos em M11:

- hardening concorrente `UpdateTask x TransitionTaskStatus`;
- M11.2A — projecao, scope, search e summaries;
- M11.2B — lookup de membros e pesquisa de Requisitions;
- M11.3A — auth, HTTP e empresa ativa;
- M11.3B — server state e primitives;
- M11.4 — board fixo e cards;
- M11.5 — movimento, acoes rapidas e autorizacao own/company.

## Contratos vigentes

### M09 Tasks

Statuses: `TODO`, `IN_PROGRESS`, `PAUSED`, `DONE`.

Transicoes validas:

```text
TODO        -> IN_PROGRESS
IN_PROGRESS -> PAUSED | DONE
PAUSED      -> IN_PROGRESS
DONE        -> nenhuma
```

`PAUSED -> DONE` e proibida; `DONE` e terminal. `completedAt` e controlado pelo dominio. Historico e append-only, com evento inicial `null -> TODO`. UoW, `FOR UPDATE`, atomicidade e tenant isolation sao obrigatorios.

### M10 Attachments

Owners Requisition/Task, tipos FILE/LINK, metadata separada de `attachment_blobs`/BYTEA, download separado e carregamento sob demanda no detalhe. O Kanban nao carrega BYTEA. Releases usam `ArtifactStorage`; anexos nao.

## M11.2A e M11.2B

`GET /companies/:companyId/tasks` suporta `scope=company|own`, search trimado por titulo, filtros combinados, summaries de assignee/Requisition, query tenant-aware sem N+1 e ordem `createdAt ASC, id ASC`. Nao carrega historico, Attachments ou BYTEA.

`GET /companies/:companyId/members` exige `users.read`, retorna membros ativos `{ userId, name }` e suporta search. `GET /companies/:companyId/requisitions` suporta search por titulo e, para termos numericos, tambem por numero. Nao existe autofill aprovado.

Validacoes PostgreSQL reais registradas: M11.2A 116 passed, 0 failed, 0 skipped; M11.2B 174 passed, 0 failed, 0 skipped.

## M11.3A — sessao e empresa ativa

- access token somente em memoria no `ApiClient`;
- nunca em `localStorage`/`sessionStorage`;
- refresh token somente no cookie HttpOnly `orbis_refresh_token`;
- refresh token nao aparece em JSON nem e acessivel ao JavaScript;
- login estabelece cookie e retorna access token + user;
- refresh preserva rotacao, hash e revogacao;
- logout revoga e limpa cookie;
- bootstrap tenta `/auth/refresh` antes de concluir ausencia de sessao.

Cookie: `HttpOnly=true`, `SameSite=Lax`, `Path=/auth`, `Secure=true` em producao e `false` em dev/test, `Max-Age` derivado de `JWT_REFRESH_TTL`, padrao 30 dias.

CORS usa `FRONTEND_ORIGIN` explicita e credentials. Refresh/logout validam `Origin` quando presente. Nao ha token CSRF adicional no contrato atual.

Frontend possui router, `/login`, `AuthProvider`, `ApiClient`, `ApiError`, refresh single-flight, `ActiveCompanyProvider` e selecao de empresa.

Validacoes registradas: backend sem PostgreSQL 602 passed, 0 failed, 64 skipped; frontend 35 passed, 0 failed, 0 skipped; identidade/refresh PostgreSQL 14 passed, 0 failed, 0 skipped; typecheck, lint e builds aprovados.

## M11.3B — server state

Usa `@tanstack/react-query`: stale time 30s, sem refetch em window focus, 4xx sem retry e rede/5xx ate duas tentativas. Query keys tenant-aware: `taskKeys`, `memberKeys`, `requisitionKeys`; `companyId` participa de toda key tenant-dependent.

Clients e hooks existem para Tasks, Members e Requisitions, com `AbortSignal` e datas ISO como strings. Hooks: `useTasks`, `useTaskDetail`, `useCompanyMembers`, `useRequisitions`.

Primitives: `LoadingState`, `ErrorState`, `EmptyState`, `Input`, `Label`, `Textarea`. Logout/ perda de sessao chama `queryClient.clear()`.

Validacao registrada: frontend 56 passed, 0 failed, 0 skipped; typecheck/lint/build aprovados.

## M11.4 — board fixo

Rota `/kanban`; componentes `KanbanPage`, `KanbanBoard`, `KanbanColumn`, `TaskCard` e `groupTasksByStatus`.

Colunas fixas: `TODO`/A Fazer, `IN_PROGRESS`/Em Andamento, `PAUSED`/Pausado e `DONE`/Concluido. Uma Task e um card; ordem do backend e preservada; status desconhecido falha explicitamente. Loading, error/retry, board empty, column empty, tema, scroll horizontal e semantica acessivel basica estao implementados.

Nao existe Board de dominio, Column persistida, position, rank ou reorder.

Validacao registrada: frontend 66 passed, 0 failed, 0 skipped; typecheck/lint/build aprovados.

## Decisao fechada: own/company

Mover/transicionar exige `tasks.update`.

`tasks.update + kanban.manage` permite qualquer Task do tenant. `tasks.update` sem `kanban.manage` permite somente Task com `task.assigneeId === actor.userId`; Task sem responsavel ou de outro usuario retorna 403. `kanban.manage` sozinho nao autoriza. `scope=own` nao e autoridade de mutation. Nao existe `tasks.move`.

A verificacao ocorre no backend, dentro da UoW, depois de `findByIdForUpdate(companyId, taskId)` e antes da transicao. Ausente/cross-tenant permanece 404.

## M11.5 — movimento e acoes rapidas

Dependencia: `@dnd-kit/core@6.3.1`. Sensores Mouse, Touch e Keyboard. DnD e acoes rapidas usam `PATCH /companies/:companyId/tasks/:taskId/status`.

```text
TODO        -> Iniciar  -> IN_PROGRESS
IN_PROGRESS -> Pausar   -> PAUSED
IN_PROGRESS -> Concluir -> DONE
PAUSED      -> Retomar  -> IN_PROGRESS
DONE        -> nenhuma
```

Drop invalido e mesma coluna sao no-op; nao ha reorder.

Mutation cancela queries relevantes, aplica patch otimista somente na Task, marca pending, bloqueia segunda mutation da mesma Task, permite Tasks diferentes em paralelo, reconcilia resposta, faz rollback granular e invalida/refaz lista/detail. `operationId` impede respostas stale de sobrescrever cache canonico posterior. Cache de outro tenant nao e alterado.

401 permanece sob responsabilidade do `ApiClient`; 403, 404, 409, 422, rede e 5xx fazem rollback/refetch com feedback.

Validacoes registradas: backend focado 30 passed; API completa sem PostgreSQL 608 passed, 66 skipped; PostgreSQL serial de autorizacao/concorrencia 3 passed; PostgreSQL serial de persistencia/UoW 12 passed; frontend completo 89 passed, 0 failed, 0 skipped; typecheck, lint, builds e `git diff --check` aprovados.

## Pendencias preservadas

- coverage global abaixo dos thresholds existentes;
- suite PostgreSQL global paralela sofre deadlocks com `TRUNCATE ... CASCADE` no mesmo banco compartilhado;
- auditoria manual em navegador real para mouse, touch, colisao, scroll horizontal, teclado visual e sessao completa.

Execucoes PostgreSQL relevantes da M11.5 foram seriais. Skips da suite global nao sao aprovacao PostgreSQL.

## Decisoes abertas

### Autofill de Requisition

Ainda nao decidido. O lookup existe, mas nao foi aprovado copiar ou sugerir title, priority, description, datas ou responsavel. Opcoes: somente associacao por `requisitionId`; associacao + sugestoes sem sobrescrever edicao; ou copia ampla. Nao decidir por convencao.

### Customizacao das colunas

Ainda nao decidida. Quatro statuses permanecem fixos, sem novos statuses ou CRUD estrutural de workflow. Label/ordem por empresa e `kanban.manage` continuam recomendacao historica, nao decisao aprovada.

### Criacao e edicao own/company

A politica de transicao esta fechada. Antes de aplicar politica equivalente a CreateTask, UpdateTask, reatribuicao ou remocao de assignee, verificar se o comportamento especifico esta formalmente definido.

Contratos vigentes: criacao exige `tasks.create`, inicia em TODO e gera `null -> TODO`; edicao permite title, description, priority, assigneeId, requisitionId, startDate e plannedEndDate; status/completedAt nao pertencem a UpdateTask; DONE e imutavel; hardening concorrente permanece obrigatorio.

## Proximo passo

A proxima unidade funcional e criacao rapida e edicao de Tasks no Kanban, aproximadamente `M11.6`, mas confirmar nome/numero em `docs/milestones/M11.md`. Antes de implementar, verificar se a politica own/company para criacao, edicao, reatribuicao e remocao de assignee precisa de decisao adicional.

## Escopo desta atualizacao

Esta sessao foi exclusivamente documental. Nenhum codigo, teste, dependencia, migration ou contrato funcional foi alterado.
