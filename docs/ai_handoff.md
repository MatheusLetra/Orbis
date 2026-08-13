# AI Handoff — Orbis

## Retomada

Leia o Prompt Mestre, `docs/AGENTS.md` e este arquivo antes de trabalhar. Este handoff descreve o estado pós-M11.6A. Não reauditar M09, M10, hardening ou M11.2A–M11.6A sem regressão concreta.

`commands/code_assist_agent.md` e `commands/code_assist_agent.skill` possuem estado preexistente fora da M11.6A.

## Estado

- M09 — Tasks: concluída.
- M10 — Attachments: concluída.
- M11 — Kanban: em andamento.
- Concluídos: hardening, M11.2A, M11.2B, M11.3A, M11.3B, M11.4, M11.5 e M11.6A.
- Concluídas também: M11.6B1 — consumo frontend de capabilities e gates de apresentação; M11.6B2 — criação rápida de Tasks.
- M11.6B3 — edição de Tasks no frontend concluída.
- M11.6B4A — detalhe básico de Task no frontend concluído.
- M11.6B4B — lookup de Attachments sob demanda concluído.
- M11.6B4C — download seguro de Attachments FILE concluído.
- M11.6B5A — upload de Attachment FILE de Task concluído.
- M11.6B5B — criação de Attachment LINK em Task concluída.
- M11.6B5C — remoção de Attachments em Task concluída.
- M12 — Pausas e apontamento de horas: em andamento.
- M12.1 — ciclo transacional de pausas de Tasks concluído.
- M12.2 — registro manual de horas por duração concluído.
- M12.3A — leitura e totalização de apontamentos por Task concluída.
- M12.3B — client e query frontend de TimeEntries concluída.

## Contratos preservados

Statuses: `TODO`, `IN_PROGRESS`, `PAUSED`, `DONE`. Transições válidas: `TODO -> IN_PROGRESS`, `IN_PROGRESS -> PAUSED|DONE`, `PAUSED -> IN_PROGRESS`; `DONE` é terminal e imutável. `completedAt` pertence ao domínio. Criação gera `null -> TODO`. UoW, `FOR UPDATE`, atomicidade e tenant isolation permanecem obrigatórios.

O Kanban possui quatro colunas fixas, sem Board/Column persistidos, position, rank ou reorder. Não carrega histórico, Attachments ou BYTEA na listagem.

## M11.5 — transição

Transicionar exige `tasks.update`. `tasks.update + kanban.manage` alcança qualquer Task do tenant; sem `kanban.manage`, somente Task atribuída ao ator. Task sem assignee ou de terceiro retorna 403. `kanban.manage` sozinho não autoriza. A decisão ocorre após `findByIdForUpdate` dentro da UoW. Ausente/cross-tenant permanece 404.

## M11.6A — criação e edição

Criação:

- `tasks.create` é obrigatória;
- sem assignee ou para o próprio ator é permitido;
- atribuir a terceiro exige também `kanban.manage`;
- `kanban.manage` sozinho não autoriza.

Edição:

- `tasks.update` é obrigatória;
- `tasks.update + kanban.manage` edita qualquer Task não `DONE` do tenant;
- sem `kanban.manage`, somente Task cujo assignee anterior é o ator pode ser editada;
- sem `kanban.manage`, Task sem assignee pode ser assumida pelo próprio ator;
- editar Task de terceiro, atribuir/reatribuir para terceiro ou remover assignee exige alcance global;
- a autorização considera assignee anterior e novo assignee após o load bloqueado na UoW;
- Task `DONE` permanece imutável; ausência/cross-tenant permanece 404.

CreateTask e UpdateTask mantêm os contratos HTTP existentes. Status e `completedAt` continuam fora de UpdateTask. Assignee precisa ser membro ativo do tenant; Requisition continua associação simples por `requisitionId` tenant-aware, sem autofill.

## Capabilities

`GET /companies/:companyId/capabilities` é autenticado e resolve permissões atuais pela membership da empresa em cada request. Retorna:

```json
{
  "companyId": "uuid",
  "capabilities": {
    "tasks.create": true,
    "tasks.update": true,
    "kanban.manage": true,
    "users.read": true,
    "requisitions.read": true
  }
}
```

Capabilities ausentes são `false`. O contrato não expõe role, access token ou refresh token e está documentado no OpenAPI. Permissões não foram adicionadas ao JWT.

M11.6B1 adicionou no frontend `capabilitiesClient`, `capabilitiesKeys`, `useCompanyCapabilities`, parser runtime sem dependência adicional e `canEditTask`. A key inclui `companyId`; o client repassa `AbortSignal`; a configuração global fornece stale time/retry. O Kanban mostra somente o placeholder desabilitado `Nova tarefa` quando capabilities carregadas indicam `tasks.create=true`. Loading, erro, ausência de dados e troca de tenant não concedem ação.

M11.6B2 substituiu o placeholder por criação rápida funcional. O modal usa HTML `dialog` sem dependências, contém somente título obrigatório e prioridade opcional com default `MEDIUM`, trata foco/Escape/erros, bloqueia submit duplicado, não faz optimistic insert, invalida somente `taskKeys.lists(companyId)` após sucesso e refaz capabilities/listas do tenant em 403. Falhas preservam o formulário.

M11.6B3 adicionou `EditTaskDialog` ao `TaskCard` somente quando `canEditTask` permite e nunca para `DONE`. O diálogo acessível carrega título/prioridade atuais, trata foco/Escape, valida título, envia somente `{ title, priority }` via PATCH, bloqueia submit duplicado, preserva valores em 403/404/422/rede/5xx e fecha apenas após sucesso. A mutation não é otimista e invalida somente `taskKeys.lists(companyId)` e `taskKeys.detail(companyId, taskId)`; 403 também atualiza capabilities do mesmo tenant.

M11.6B4A adicionou `TaskDetailDialog` aberto por ação explícita no `TaskCard` para qualquer status, incluindo `DONE`. O modal acessível usa HTML `dialog`, `useTaskDetail` habilitado somente ao abrir, exibe campos completos da Task e histórico de status, trata loading/error/empty/retry, mensagens para 403/404/rede/5xx, foco/Escape/restauração e reseta a seleção quando `activeCompany.id` muda. Nenhum Attachment ou BYTEA é carregado.

M11.6B4B adicionou `AttachmentOutput` e parser runtime local, `attachmentsClient.listForTask`, `attachmentKeys.task` e `useTaskAttachments`. Attachments são buscados somente quando o detalhe está aberto, a listagem retorna somente metadados e permanece isolada por `companyId`/`taskId`. A UI separa FILE/LINK, permite links externos em nova aba com segurança e informa que o download de FILE será disponibilizado posteriormente. BYTEA não é carregado no Kanban nem no detalhe. Download, upload e remoção continuam pendentes.

M11.6B4C adicionou `ApiClient.requestBlob` sem alterar o parser JSON existente e `attachmentsClient.downloadTaskFile`. O download FILE é explícito, tenant-aware, repassa `AbortSignal`, preserva MIME, interpreta `Content-Disposition` com fallback seguro, rejeita inconsistência de `Content-Length` como 422 e não armazena Blob no React Query. A UI bloqueia cliques duplicados por Attachment, permite tentativas posteriores, cria/revoga object URL e não oferece download para LINK. Upload e remoção continuam pendentes.

Hardening pós-M11.6B4C concluiu o lifecycle de downloads FILE. `TaskDetailDialog` mantém `AbortController` por Attachment, aborta no fechamento, desmontagem e troca de `companyId`/`taskId`, ignora cancelamentos, invalida respostas stale antes de criar Blob ou iniciar download e garante `URL.revokeObjectURL` em exceção de `link.click()`. Downloads de Attachments diferentes continuam independentes. Upload e remoção permanecem fora do escopo.

M11.6B5A adicionou upload FILE sob demanda no detalhe da Task. `ApiClient` suporta `FormData` sem serialização JSON ou `Content-Type` manual; `attachmentsClient.uploadTaskFile` usa multipart, codifica IDs, valida metadata e repassa signal. A mutation exige `tasks.update` na apresentação, não faz optimistic insert, invalida somente a query da Task, aborta em fechamento/desmontagem/troca tenant/task, ignora cancelamentos e preserva o formulário em erros. Upload em Task `DONE` permanece permitido pelo backend atual. LINK e remoção continuam pendentes.

M11.6B5B adicionou criação de LINK sob demanda no detalhe da Task. O client usa o endpoint tenant-aware, payload JSON `{ url, title }`, IDs codificados, parser de `AttachmentOutput` e `AbortSignal`. A mutation exige `tasks.update`, não faz optimistic insert, invalida somente a query da Task, aborta no fechamento/desmontagem/troca tenant/task, ignora cancelamentos e refaz capabilities em 403. A UI valida URL HTTP/HTTPS e título como feedback preliminar, preserva valores em erro, fecha e limpa somente após sucesso e permite LINK em Task `DONE`.

M11.6B5C concluiu a remoção de Attachments FILE e LINK em Task. O backend confirmou a permissão `tasks.update`, resposta `{ id }`, suporte aos dois tipos e suporte em Task `DONE`. O client usa DELETE tenant-aware com IDs codificados, signal e parser de remoção. A mutation bloqueia duplicidade por Attachment, permite operações independentes, invalida somente a query da Task após sucesso, aborta em lifecycle, ignora AbortError, refaz capabilities em 403 e refaz a listagem canônica em 404. A UI confirma acessivelmente, informa o título/nome, mantém o item até resposta/refetch e preserva o detalhe em erros.

Hardening final pós-M11.6B5C concluiu o controle de foco da confirmação de remoção: foco inicial previsível, `Tab`/`Shift+Tab` contido, `Escape` sem fechar o detalhe externo e restauração no botão acionador após cancelamento ou sucesso. O sucesso de remoção também é protegido por `signal.aborted` após a invalidação. A auditoria manual em browser real continua pendente; não há alteração de backend, permissões ou contratos.

## Validações M11.6A

- Aplicação focada: 58 passed, 0 failed, 0 skipped.
- HTTP/OpenAPI focado: 30 passed, 0 failed, 0 skipped.
- Primeira tentativa PostgreSQL sem banco: 18 skipped; não conta como aprovação.
- Segunda tentativa em `localhost:5433/orbis_test`, após iniciar o container preexistente `orbis-postgres-test`, serial: 18 passed, 0 failed, 0 skipped.
- API completa deliberadamente sem PostgreSQL: 624 passed, 0 failed, 69 skipped; skips são suites condicionais de banco.
- Typecheck, lint, build e `git diff --check`: aprovados.

## Pendências preservadas

- coverage global abaixo dos thresholds existentes;
- suíte PostgreSQL global paralela sofre deadlocks com `TRUNCATE ... CASCADE` no mesmo banco;
- auditoria manual em navegador real da M11.5;
- autofill de Requisition e customização das colunas continuam fora de escopo/não aprovados;
- Auditoria manual em browser real continua pendente.

## M12.1 — ciclo de pausas

`TaskPauseInterval` representa intervalos abertos/fechados e calcula segundos inteiros completos. `IN_PROGRESS → PAUSED` abre a pausa; `PAUSED → IN_PROGRESS` fecha; `PAUSED → DONE` fecha e conclui diretamente, registrando somente `PAUSED → DONE`. O mesmo `occurredAt` alimenta `endedAt`, `completedAt`, `updatedAt` e `changedAt` quando aplicável.

`TransitionTaskStatus` preserva `tasks.update`, alcance adicional por `kanban.manage`, membership ativa, tenant isolation e `findByIdForUpdate`. Task, pausa e histórico usam a mesma UoW e transação. Intervalo duplicado, pausa ausente, estado inconsistente, fechamento repetido e datas inválidas falham sem persistência parcial. O lock da Task pai serializa o agregado; não houve migration, endpoint, capability ou dependência nova.

Validações: domínio/aplicação/HTTP/OpenAPI focados 88 passed; PostgreSQL real focado serial em `localhost:5432/orbis_test` 22 passed, 0 skipped; API completa sem PostgreSQL 639 passed, 73 skips condicionais; typecheck, lint, build e `git diff --check` aprovados. A tentativa global com PostgreSQL ativo reproduziu os deadlocks paralelos conhecidos e não foi considerada aprovação.

## Próximo passo

## M12.2 — registro manual de horas

`POST /companies/:companyId/tasks/:taskId/time-entries` registra somente `durationMinutes` inteiro entre 1 e 1440 e `description` opcional trimada até 1000 caracteres. `startedAt` e `endedAt` são nulos; `userId`, `companyId` e `createdAt` são controlados pelo backend. Tasks nos status `TODO`, `IN_PROGRESS`, `PAUSED` e `DONE` são elegíveis. O registro não altera Task, status, pausa, histórico, estimativa ou capacidade e não possui listagem, edição, remoção, intervalo ou sobreposição nesta unidade.

A autorização exige `hours.register` e membership ativa. Sem `kanban.manage`, somente Task atribuída ao ator é permitida; com `hours.register + kanban.manage`, qualquer Task do tenant é permitida; `kanban.manage` sozinho não autoriza. A Task é carregada com `findByIdForUpdate` depois da validação tenant-aware, e a entrada é persistida na mesma `TaskUnitOfWork`.

Validações M12.2: domínio/aplicação/HTTP focados 28 passed; PostgreSQL real serial em `localhost:5432/orbis_test` 23 passed, 0 skipped; API completa sem PostgreSQL 657 passed, 74 skips condicionais; typecheck, lint, build e `git diff --check` aprovados. A suíte PostgreSQL global paralela não foi executada por causa dos deadlocks conhecidos.

## M12.3A — leitura de TimeEntries

`GET /companies/:companyId/tasks/:taskId/time-entries` exige `tasks.read` e membership ativa. Não exige `hours.register`, `tasks.update` ou `hours.read`. Task `DONE` e os demais status são elegíveis conforme a leitura da Task; ausência/cross-tenant permanece 404.

O contrato aceita `limit` opcional de 1 a 100, default 100, sem filtros adicionais ou cursor. A resposta retorna `items`, `totalDurationMinutes` e `hasMore`, ordenados por `createdAt ASC, id ASC`. O total soma todas as durações da Task, não somente os itens limitados, e não inclui `TaskPauseInterval`, estimativas ou capacidade. O retorno preserva `userId`, `startedAt: null` e `endedAt: null`, sem join de usuários.

Validações M12.3A: domínio/aplicação/HTTP focados 36 passed; PostgreSQL real serial em `localhost:5432/orbis_test` 24 passed, 0 skipped; API completa sem PostgreSQL 665 passed, 75 skips condicionais; typecheck, lint, build e `git diff --check` aprovados. A suíte PostgreSQL global paralela não foi executada por causa dos deadlocks conhecidos.

## M12.3B — client e query frontend

O app agora possui `TimeEntryOutput`/`TimeEntryListOutput` com parser runtime, `timeEntriesClient.listForTask`, `timeEntryKeys.task(companyId, taskId, limit)` e `useTaskTimeEntries`. O client usa o GET existente, codifica IDs, envia limite opcional e repassa AbortSignal. O hook usa limite default 100, exige `companyId`, `taskId` e `enabled=true`, e permanece pronto para carregamento sob demanda no detalhe sem disparar no Kanban inicial. Não há UI, formulário, mutation ou alteração de backend.

Validação M12.3B: app completo 204 passed, 0 failed, 0 skipped; typecheck, lint, build e `git diff --check` aprovados. A auditoria manual de Attachments permanece pendente.

## Próximo passo

Próxima unidade recomendada: M12.3C — exibição de horas no detalhe da Task, com lista, total, loading/error/empty e retry sob demanda. Edição, remoção, filtros adicionais e apontamento por intervalo continuam fora do escopo. A auditoria manual real de Attachments continua pendente por limitação RDP/Wayland, mas não bloqueia M12. Backend continua sendo a autoridade. Upload de Requisition e outras funcionalidades futuras permanecem fora do escopo.
