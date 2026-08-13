# Plano de Implementação — Orbis

Este documento funciona como índice e roadmap das milestones do Orbis. O conteúdo operacional de cada milestone está no respectivo arquivo em [`milestones/`](milestones/).

## Ordem das milestones

| Ordem | Milestone | Arquivo | Status |
|---|---|---|---|
| 1 | M01 — Fundação dos projetos | [M01.md](milestones/M01.md) | Concluída |
| 2 | M02 — Infraestrutura de dados | [M02.md](milestones/M02.md) | Concluída |
| 3 | M03 — Núcleo compartilhado | [M03.md](milestones/M03.md) | Concluída |
| 4 | M04 — Identidade: empresas, usuários e memberships | [M04.md](milestones/M04.md) | Concluída |
| 5 | M05 — Autenticação JWT | [M05.md](milestones/M05.md) | Concluída |
| 6 | M06 — Autorização por permissões | [M06.md](milestones/M06.md) | Concluída |
| 7 | M07 — Catálogo de software | [M07.md](milestones/M07.md) | Concluída |
| 8 | M08 — Requisições | [M08.md](milestones/M08.md) | Concluída |
| 9 | M09 — Tarefas e histórico de status | [M09.md](milestones/M09.md) | Concluída |
| 10 | M10 — Anexos de requisições e tarefas | [M10.md](milestones/M10.md) | Concluída |
| 11 | M11 — Kanban | [M11.md](milestones/M11.md) | Em andamento |
| 12 | M12 — Pausas e apontamento de horas | [M12.md](milestones/M12.md) | Em andamento |
| 13 | M13 — Capacidade e previsão | [M13.md](milestones/M13.md) | Não iniciada |
| 14 | M14 — Timeline semanal | [M14.md](milestones/M14.md) | Não iniciada |
| 15 | M15 — Timeline mensal/anual | [M15.md](milestones/M15.md) | Não iniciada |
| 16 | M16 — Notificações | [M16.md](milestones/M16.md) | Não iniciada |
| 17 | M17 — Chat | [M17.md](milestones/M17.md) | Não iniciada |
| 18 | M18 — Relatórios | [M18.md](milestones/M18.md) | Não iniciada |
| 19 | M19 — Auditoria | [M19.md](milestones/M19.md) | Não iniciada |
| 20 | M20 — Hardening, observabilidade e deploy | [M20.md](milestones/M20.md) | Não iniciada |

## Dependências resumidas

```text
M01 → M02 → M03 → M04 → M05 → M06 → M07
                         └──────→ M08 → M09 → M10 → M11
M06 → M13 → M14 → M15
M09 → M12
M04/M05 → M16 → M17
M09/M12/M13 → M18
M04/M05/M06 → M19
Todas → M20
```

## Regras de execução

- Executar as milestones na ordem indicada, respeitando suas dependências.
- Consultar o arquivo da milestone antes de iniciar sua execução.
- Registrar decisões ambíguas como **A confirmar**, sem inventar comportamento.
- Aplicar às milestones as regras transversais já documentadas em `AGENTS.md`, `ai_context.md` e `architecture.md`.

## Correção pré-M11

Antes de iniciar M11, foi implementado o `LocalArtifactStorage` previsto em M07 e corrigido o escopo do `.gitignore` para preservar o código-fonte do adapter. O módulo Releases recebeu testes reais de filesystem. M11 está **Em andamento**; o hardening concorrente e as unidades M11.2A, M11.2B, M11.3A, M11.3B, M11.4 e M11.5 foram concluídos.

## Progresso M11

- [x] Hardening concorrente `UpdateTask × TransitionTaskStatus`.
- [x] M11.2A — projeção de cards, scope, search e summaries.
- [x] M11.2B — lookup de membros e pesquisa de Requisitions.
- [x] M11.3A — auth, HTTP, sessão por cookie HttpOnly e empresa ativa.
- [x] M11.3B — server state, clients, query keys tenant-aware e primitives.
- [x] M11.4 — board fixo, quatro colunas e cards somente leitura.
- [x] M11.5 — DnD, ações rápidas, optimistic update e autorização own/company.
- [x] M11.6A — autorização backend de criação/edição e capabilities tenant-aware.
- [x] M11.6B1 — consumo frontend de capabilities tenant-aware e gates de apresentação.
- [x] M11.6B2 — criação rápida de Tasks no frontend.
- [x] M11.6B3 — edição de Tasks no frontend.
- [x] M11.6B4A — detalhe básico de Task no frontend.
- [x] M11.6B4B — lookup de Attachments sob demanda.
- [x] M11.6B4C — download seguro de Attachments FILE.
- [x] M11.6B5A — upload de Attachment FILE de Task.
- [x] M11.6B5B — criação de Attachment LINK em Task.
- [x] M11.6B5C — remoção de Attachments em Task.
- [ ] Autofill de Requisition — decisão aberta.
- [ ] Customização das colunas — decisão aberta.

Pendências transversais preservadas: coverage global abaixo dos thresholds; deadlocks da suíte PostgreSQL paralela com `TRUNCATE ... CASCADE`; auditoria manual browser ainda não executada.

M11.6A fechou a política de criação/edição: `tasks.create`/`tasks.update` permanecem obrigatórias; `kanban.manage` adiciona alcance global sem substituir a permissão operacional; criação sem assignee ou para si é permitida; self-claim de Task sem responsável é permitido; atribuição a terceiro, reatribuição, remoção de assignee e edição de Task de terceiro exigem alcance global. `GET /companies/:companyId/capabilities` expõe somente capabilities efetivas allowlisted para a empresa autenticada.

M11.6B1 adicionou o consumo frontend tenant-aware desse endpoint, sem persistir permissões e sem criar formulário ou mutation. O gate `Nova tarefa` permanece desabilitado como placeholder e só aparece com capability carregada explicitamente como `tasks.create=true`.

M11.6B2 implementou a criação rápida com modal HTML `dialog`, título obrigatório, prioridade `MEDIUM` por padrão, mutation sem optimistic insert, invalidação tenant-aware e tratamento de erro mantendo os valores do formulário.

M11.6B3 implementou edição acessível de título e prioridade a partir do `TaskCard`, condicionada a `canEditTask` e nunca disponível para `DONE`. A mutation usa PATCH, bloqueia submissão duplicada, preserva o formulário em falhas, não aplica optimistic update e invalida apenas listas e detalhe da Task no `companyId` informado.

M11.6B4A implementou visualização detalhada de Task aberta explicitamente pelo `TaskCard`. O modal acessível usa HTML `dialog`, carrega `TaskDetail` e histórico de status sob demanda via `useTaskDetail`, trata loading/error/empty/retry, mensagens para 403/404/rede/5xx, foco/Escape/restauração e reseta a seleção ao trocar de empresa. Attachments e BYTEA não foram carregados.

M11.6B4B implementou `AttachmentOutput`, parser runtime local, client e query key tenant-aware para listar Attachments da Task somente com o detalhe aberto. A UI separa FILE/LINK, exibe loading/error/retry/empty e metadados; links abrem com `noopener noreferrer`, enquanto FILE informa que o download virá em unidade posterior. Nenhuma resposta ou requisição carrega BYTEA. Upload, download e remoção permanecem fora desta unidade.

M11.6B4C adicionou um caminho binário explícito no `ApiClient`, preservando autenticação/refresh e erros JSON estruturados, além de `attachmentsClient.downloadTaskFile`. O download FILE usa Blob e object URL apenas após clique, extrai `filename*`/`filename` com fallback seguro, preserva MIME, valida `Content-Length`, bloqueia duplicidades por Attachment e revoga a URL após uso. Nenhum Blob é armazenado em React Query; LINK continua sem download interno. Upload e remoção permanecem pendentes.

Hardening pós-M11.6B4C concluiu o lifecycle de downloads FILE: `AbortController` por Attachment é repassado ao client e abortado no fechamento, desmontagem e troca de tenant/task; respostas stale não criam Blob nem iniciam download; cancelamentos são silenciosos; e `URL.revokeObjectURL` é garantido mesmo quando `link.click()` falha. Upload e remoção permanecem fora do escopo. Auditoria manual em browser real continua pendente.

M11.6B5A implementou upload de um Attachment FILE a partir do `TaskDetailDialog`. O `ApiClient` encaminha `FormData` diretamente sem `JSON.stringify` nem `Content-Type` manual; `attachmentsClient.uploadTaskFile` usa o endpoint tenant-aware, valida `AttachmentOutput` e repassa `AbortSignal`. A mutation exige apresentação condicionada a `tasks.update`, não é otimista, invalida somente `attachmentKeys.task(companyId, taskId)`, aborta no lifecycle e preserva o formulário em erro. Task `DONE` pode receber Attachment porque o backend atual permite e Attachment não altera status. LINK e remoção permanecem pendentes.

M11.6B5B implementou criação de Attachment LINK no `TaskDetailDialog`. `attachmentsClient.createTaskLink` usa `POST /companies/:companyId/tasks/:taskId/attachments/links`, codifica IDs, envia `{ url, title }`, repassa `AbortSignal` e valida `AttachmentOutput`. A mutation não faz optimistic insert, invalida somente `attachmentKeys.task(companyId, taskId)`, aborta no lifecycle e atualiza capabilities em 403. A UI exige `tasks.update` carregada, valida URL HTTP/HTTPS e título preliminarmente, anuncia pending, preserva valores em erro e fecha/limpa somente após sucesso. Task `DONE` pode criar LINK. Remoção permanece pendente.

M11.6B5C implementou remoção de Attachments FILE e LINK em Task. O backend confirmou `DELETE /companies/:companyId/tasks/:taskId/attachments/:attachmentId`, resposta `{ id }`, autorização `tasks.update`, validação tenant-aware e aceitação para Task `DONE`. O client codifica todos os IDs, repassa `AbortSignal`, não carrega BYTEA/Blob e valida o DTO de remoção. A mutation bloqueia o mesmo Attachment, permite IDs diferentes em paralelo, não é otimista, invalida somente a query da Task, aborta no lifecycle, ignora cancelamentos e refaz capabilities/lista canônica nos status aplicáveis. A UI usa confirmação acessível, mantém o item até sucesso confirmado e exibe erros sem inutilizar o detalhe.

Hardening final pós-M11.6B5C adicionou isolamento de foco à confirmação de remoção: foco inicial no primeiro controle, ciclo de `Tab`/`Shift+Tab`, `Escape` restrito à confirmação e restauração do foco no botão acionador após cancelar ou concluir. A mutation de remoção verifica explicitamente `signal.aborted` também após a invalidação, preservando proteção stale e cancelamento silencioso. Auditoria manual em browser real continua pendente.

## Progresso M12

- [x] M12.1 — ciclo transacional de pausas de Tasks.
- [x] M12.2 — registro manual de horas por duração.
- [x] M12.3A — leitura e totalização de apontamentos por Task.
- [x] M12.3B — client e query frontend de TimeEntries.
- [ ] M12.3C — exibição de horas no detalhe da Task.

M12.1 integrou `TaskPauseInterval` à `TaskUnitOfWork`. `IN_PROGRESS → PAUSED` abre um intervalo; `PAUSED → IN_PROGRESS` o fecha; e `PAUSED → DONE` fecha a pausa e conclui diretamente, com um único histórico `PAUSED → DONE`. `endedAt`, `completedAt`, `updatedAt` e `changedAt` compartilham o instante da transição quando aplicável; a duração usa segundos inteiros completos. Task, pausa e histórico são atômicos e as transições concorrentes são serializadas pelo `FOR UPDATE` da Task pai. O PATCH de status, as permissões e o OpenAPI foram preservados, sem migration, endpoint ou dependência nova.

Validação M12.1: 88 testes focados de domínio/aplicação/HTTP passaram; 22 testes PostgreSQL focados passaram serialmente sem skips; a API sem banco executou 639 testes com 73 skips condicionais. Typecheck, lint, build e `git diff --check` passaram. A suíte PostgreSQL global paralela reproduziu os deadlocks já conhecidos e não foi considerada aprovação.

M12.2 implementou o registro backend-only de `TimeEntry` manual por `durationMinutes`, no intervalo inclusivo de 1 a 1440 minutos. O endpoint aninhado é `POST /companies/:companyId/tasks/:taskId/time-entries`; `description` é opcional, trimada e limitada a 1000 caracteres; `startedAt` e `endedAt` permanecem nulos. A autorização usa `hours.register` com membership ativa e política own/global por `kanban.manage`, sem exigir `tasks.update`. Tasks em todos os status, inclusive `DONE`, são elegíveis. O TimeEntry é criado na UoW após `findByIdForUpdate`, sem alterar Task, pausa, histórico, estimativa ou capacidade. Listagem, edição, remoção, intervalos, sobreposição e frontend ficam para unidades posteriores.

Validação M12.2: 28 testes focados de domínio/aplicação/HTTP passaram; 23 testes PostgreSQL focados passaram serialmente sem skips; a API sem banco executou 657 testes com 74 skips condicionais. Typecheck, lint, build e `git diff --check` passaram. A suíte PostgreSQL global paralela não foi executada por causa dos deadlocks conhecidos.

M12.3A implementou `GET /companies/:companyId/tasks/:taskId/time-entries`, com autorização `tasks.read` e membership ativa. O contrato aceita somente `limit` entre 1 e 100 (default 100), ordena por `createdAt ASC, id ASC`, retorna `items`, `totalDurationMinutes` e `hasMore`, e soma todas as entradas da Task independentemente do limite. Pausas, estimativa, capacidade e horas calculadas permanecem separados; não há joins de usuários, filtros adicionais, cursor ou frontend nesta unidade.

Validação M12.3A: 36 testes focados de domínio/aplicação/HTTP passaram; 24 testes PostgreSQL focados passaram serialmente sem skips; a API sem banco executou 665 testes com 75 skips condicionais. Typecheck, lint, build e `git diff --check` passaram. A suíte PostgreSQL global paralela não foi executada por causa dos deadlocks conhecidos.

M12.3B adicionou o suporte frontend à leitura de TimeEntries sem UI. `timeEntriesClient.listForTask` é tenant-aware, codifica IDs, repassa AbortSignal e envia limite opcional; `timeEntryKeys.task` inclui companyId, taskId e limit; `useTaskTimeEntries` é habilitado explicitamente e não dispara no Kanban inicial. O parser runtime valida o contrato completo e a política global de React Query mantém stale time/retry.

Validação M12.3B: suíte completa do app 204 passed, 0 failed, 0 skipped; typecheck, lint, build e `git diff --check` aprovados. Backend, OpenAPI e migrations não foram alterados.
