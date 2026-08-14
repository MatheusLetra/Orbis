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
| 12 | M12 — Pausas e apontamento de horas | [M12.md](milestones/M12.md) | Concluída |
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
- [x] M12.3C — exibição de horas no detalhe da Task.
- [x] M12.4A — capability `hours.register` exposta tenant-aware.
- [x] M12.4B — client e mutation de TimeEntry.
- [x] M12.4C — formulário e integração no detalhe da Task.
- [x] M12.4 — hardening e auditoria manual do fluxo concluídos.

M12.1 integrou `TaskPauseInterval` à `TaskUnitOfWork`. `IN_PROGRESS → PAUSED` abre um intervalo; `PAUSED → IN_PROGRESS` o fecha; e `PAUSED → DONE` fecha a pausa e conclui diretamente, com um único histórico `PAUSED → DONE`. `endedAt`, `completedAt`, `updatedAt` e `changedAt` compartilham o instante da transição quando aplicável; a duração usa segundos inteiros completos. Task, pausa e histórico são atômicos e as transições concorrentes são serializadas pelo `FOR UPDATE` da Task pai. O PATCH de status, as permissões e o OpenAPI foram preservados, sem migration, endpoint ou dependência nova.

Validação M12.1: 88 testes focados de domínio/aplicação/HTTP passaram; 22 testes PostgreSQL focados passaram serialmente sem skips; a API sem banco executou 639 testes com 73 skips condicionais. Typecheck, lint, build e `git diff --check` passaram. A suíte PostgreSQL global paralela reproduziu os deadlocks já conhecidos e não foi considerada aprovação.

M12.2 implementou o registro backend-only de `TimeEntry` manual por `durationMinutes`, no intervalo inclusivo de 1 a 1440 minutos. O endpoint aninhado é `POST /companies/:companyId/tasks/:taskId/time-entries`; `description` é opcional, trimada e limitada a 1000 caracteres; `startedAt` e `endedAt` permanecem nulos. A autorização usa `hours.register` com membership ativa e política own/global por `kanban.manage`, sem exigir `tasks.update`. Tasks em todos os status, inclusive `DONE`, são elegíveis. O TimeEntry é criado na UoW após `findByIdForUpdate`, sem alterar Task, pausa, histórico, estimativa ou capacidade. Listagem, edição, remoção, intervalos, sobreposição e frontend ficam para unidades posteriores.

Validação M12.2: 28 testes focados de domínio/aplicação/HTTP passaram; 23 testes PostgreSQL focados passaram serialmente sem skips; a API sem banco executou 657 testes com 74 skips condicionais. Typecheck, lint, build e `git diff --check` passaram. A suíte PostgreSQL global paralela não foi executada por causa dos deadlocks conhecidos.

M12.3A implementou `GET /companies/:companyId/tasks/:taskId/time-entries`, com autorização `tasks.read` e membership ativa. O contrato aceita somente `limit` entre 1 e 100 (default 100), ordena por `createdAt ASC, id ASC`, retorna `items`, `totalDurationMinutes` e `hasMore`, e soma todas as entradas da Task independentemente do limite. Pausas, estimativa, capacidade e horas calculadas permanecem separados; não há joins de usuários, filtros adicionais, cursor ou frontend nesta unidade.

Validação M12.3A: 36 testes focados de domínio/aplicação/HTTP passaram; 24 testes PostgreSQL focados passaram serialmente sem skips; a API sem banco executou 665 testes com 75 skips condicionais. Typecheck, lint, build e `git diff --check` passaram. A suíte PostgreSQL global paralela não foi executada por causa dos deadlocks conhecidos.

M12.3B adicionou o suporte frontend à leitura de TimeEntries sem UI. `timeEntriesClient.listForTask` é tenant-aware, codifica IDs, repassa AbortSignal e envia limite opcional; `timeEntryKeys.task` inclui companyId, taskId e limit; `useTaskTimeEntries` é habilitado explicitamente e não dispara no Kanban inicial. O parser runtime valida o contrato completo e a política global de React Query mantém stale time/retry.

Validação M12.3B: suíte completa do app 204 passed, 0 failed, 0 skipped; typecheck, lint, build e `git diff --check` aprovados. Backend, OpenAPI e migrations não foram alterados.

M12.3C concluiu a exibição sob demanda de horas no `TaskDetailDialog`. O bloco “Horas apontadas” mostra o total de minutos, as entradas na ordem recebida, duração, descrição opcional, `userId` e `createdAt`; deixa explícita a separação de pausas e estimativas, sem inventar nomes de usuários. Loading, erro com retry, vazio, total zero e `hasMore` são acessíveis e isolados do restante do detalhe. Criação frontend ainda não foi implementada; a auditoria manual de Attachments permanece pendente.

Validação M12.3C: suíte completa do app 208 passed, 0 failed, 0 skipped (execução serial); typecheck, lint, build e `git diff --check` aprovados. Nenhuma alteração externa em backend, OpenAPI, migrations, `commands/` ou M11.6 foi feita.

M12.4A expôs `hours.register` no contrato autenticado e tenant-aware de capabilities. O backend inclui a capability no allowlist e no schema OpenAPI, resolvendo o valor pelas permissões efetivas da membership em cada request. O frontend atualiza o parser estrito para exigir o novo campo e rejeitar capabilities ausentes ou inesperadas. A autorização de `RegisterTimeEntry`, tokens, Attachments e M11.6 foram preservados; UI, client e mutation permanecem fora desta unidade.

Validação M12.4A: backend focado 28 passed, frontend focado 8 passed, API completa 740 passed e app completo 212 passed; todos com 0 failed e 0 skipped em execução serial. Typecheck, lint, build em API/app e `git diff --check` aprovados. Auditoria manual de Attachments continua pendente. Próxima unidade: M12.4B — client e mutation de TimeEntry.

M12.4B adicionou `timeEntriesClient.createForTask`, o parser exportável de `TimeEntryOutput`, `timeEntryKeys.taskPrefix` e `useRegisterTimeEntry`. A mutation envia apenas payload normalizado, não faz optimistic insert, invalida exclusivamente o prefixo tenant/Task correspondente e suporta abort/generation, callbacks opcionais e isolamento de respostas stale. Não há UI, botão, formulário ou mensagens de erro nesta unidade.

Validação M12.4B: testes focados 17 passed, 0 failed, 0 skipped; app completo 226 passed, 0 failed, 0 skipped (execução serial); typecheck, lint, build e `git diff --check` aprovados. Nenhuma alteração foi feita em backend, OpenAPI, migrations, `commands/`, M11.6 ou Attachments. Próxima unidade: M12.4C — formulário e integração no detalhe.

M12.4C integrou o registro manual no `TaskDetailDialog` com predicate tenant-aware baseado em `hours.register`, usuário autenticado, tenant ativo, assignee e `kanban.manage`. Task própria é permitida; Task de terceiro e Task sem assignee exigem alcance global; `DONE` segue as mesmas regras. O formulário acessível usa um subdialogo HTML via portal, recebe `isOpen` do detalhe, aborta explicitamente ao fechar ou trocar tenant/Task, não restaura foco no diálogo pai fechado e ignora sucesso stale. A mutation permanece sem optimistic insert, com invalidação/refetch canônico restrito à mesma Task/tenant.

Validação M12.4C/hardening: testes focados 59 passed, 0 failed, 0 skipped; app completo 246 passed, 0 failed, 0 skipped (execução serial); typecheck, lint, build e `git diff --check` aprovados. Backend, OpenAPI, migrations, `commands/`, M11.6 e Attachments foram preservados. A correção do predicate para Task sem assignee tem alcance global somente com `kanban.manage`; o backend continua autoridade final.

Auditoria manual M12.4 tentada em 2026-08-13, sem alteração de código. PostgreSQL, API, Vite, Chrome visível e DevTools estavam ativos; dados reais de auditoria foram preparados para os tenants e cenários requeridos. A autenticação no Chrome falhou na camada de interação: a UI exibiu erro genérico sem request de login observável, embora o endpoint respondesse 200 fora da UI e o refresh respondesse 200 no contexto do navegador. O único 404 observado foi `/favicon.ico`. Todos os cenários funcionais da auditoria foram registrados como **não executados** por esse bloqueio; não houve falha M12.4 reproduzida nem BUILD específico. Esse registro representa a tentativa bloqueada anterior e foi posteriormente supersedido pela auditoria manual concluída abaixo.

Auditoria manual posterior de M12.4 realizada com sucesso em Chrome visível, com interação física de teclado e mouse. O login funcionou, o passo a passo relevante foi executado, o botão `Registrar horas` e o registro manual funcionaram, e lista e total foram atualizados. As regras de Task própria, terceiro, sem assignee e `DONE`, além de foco, Escape, fechamento e troca de contexto, funcionaram conforme esperado. Nenhuma falha funcional foi observada. M12.4A, M12.4B, M12.4C e hardening estão concluídos e M12.4 está encerrada/validada. A auditoria manual de Attachments permanece independente; a próxima unidade formal de M12 é M13 — Capacidade e previsão.

Auditoria visual posterior de responsividade: em Chrome visível com DevTools e viewports `320x844`, `360x800`, `390x844` e desktop, foram observados corte do detalhe da Task nas três viewports mobile, acessibilidade ruim das colunas em `390x844`, quase sobreposição do seletor de empresa ao logo em `320x844` e distribuição ruim das colunas no desktop, com aproximadamente 25% da tela em fundo preto. O header desktop foi aprovado e o header em `390x844` foi aprovado. As demais áreas específicas não decompostas foram registradas como **não executadas**. Próximo BUILD recomendado: correção mínima de responsividade/acessibilidade do header, colunas e detalhe, sem alterar contratos funcionais de M11/M12.

Correção pós-auditoria: `TaskDetailDialog` recebeu largura segura, `max-height` por `100dvh`, cabeçalho fixo e scroll interno do conteúdo, preservando foco, Escape, restauração, Attachments, TimeEntries, formulários e lifecycle. Testes focados: 33 passed; suíte serial do app: 249 passed; typecheck, lint, build e `git diff --check` aprovados. A validação manual pós-correção nos quatro viewports permanece pendente; header, seletor e distribuição externa do Kanban continuam para unidade posterior.

R1 foi reestruturada em composição mobile-first explícita: container flexível com altura de viewport, `header` fixo, `main` com scroll interno e `footer` acessível. A implementação preserva os contratos funcionais de M11/M12. Validação automatizada: 249 testes serializados aprovados; typecheck, lint, build e `git diff --check` aprovados. A validação manual real pós-R1 permanece pendente.

R1 foi posteriormente corrigida de forma definitiva por reescrita estrutural e validada em Chrome visível. O detalhe deixou de depender de `<dialog>` e passou a usar portal, backdrop e painel próprios alinhados ao `visualViewport`, inclusive sob escala/emulação incomum; `RegisterTimeEntryDialog` usa a mesma estratégia. Medidas do painel: 304px em `320x844`, 344px em `360x800`, 352.02px nas emulações solicitadas de `375x844` e `390x844` cuja largura visual efetiva foi 368.02px, e 768px centralizados em `1440x900`. Header/footer permaneceram visíveis e o `main` foi rolável em todos os cenários. Automação final: 260 passed, 0 failed, 0 skipped; typecheck, lint, build e diff-check aprovados. Nenhuma alteração funcional ocorreu em Attachments ou M12.4; R2 e R3 permanecem pendentes, e a próxima unidade é R2.

R2 foi implementada e validada como correção isolada do AppShell/header. No mobile, a marca fica separada dos controles e o seletor ocupa a largura fluida restante com `min-width: 0`, ellipsis, `title` com nome completo e alvo de toque de 44px; no desktop, o header retorna à composição horizontal. Chrome visível aprovou `320x844` (`right=304`), `360x800` (`right=344`), `390x844` (`right=374`) e desktop `1440x900` (`right=1416`), sem overlap, corte ou overflow horizontal. Troca de empresa, tema, logout, foco e Tab/Shift+Tab foram confirmados; logout retornou a `/login`. Automação final: 264 passed, 0 failed, 0 skipped; typecheck, lint, build e diff-check aprovados. TaskDetail, Attachments e TimeEntry permaneceram preservados. R3 — Kanban responsivo — é a próxima unidade; auditoria funcional de Attachments continua independente.

R3 foi concluída na camada de apresentação do Kanban. O mobile agora usa faixa horizontal intencional com snap, hint de navegação, colunas fluidas por viewport, `overflow: clip` externo e foco que reposiciona o scroll para controles fora da área visível. O desktop usa grid fluido de quatro colunas. Cards longos quebram, ações recebem alvos de toque de 44px e o DnD por teclado mantém instruções e live region do dnd-kit. Chrome aprovou `320x844` (288px por coluna), `360x800` (328px), `390x844` (358px) e desktop solicitado `1440x900` (viewport efetiva 1425px, aproximadamente 328px por coluna), sem overflow externo. Loading foi exercitado manualmente; error/empty ficaram cobertos por automação e não foram reproduzidos manualmente. Automação final: 266 passed, 0 failed, 0 skipped; typecheck, lint, build e diff-check aprovados. R4 — demais dialogs/formulários — é a próxima unidade; Attachments continua pendente independente.

R4 foi implementada com a primitive local `ResponsiveDialog` para QuickTask e EditTask. A primitive fornece backdrop por `visualViewport`, painel mobile seguro, main rolável, header/footer fixos, foco inicial, trap de Tab/Shift+Tab, Escape, restauração externa e bloqueio de overflow do body. RegisterTimeEntry foi alinhado no desktop sem alterar seu comportamento; formulários FILE/LINK e confirmação de remoção permaneceram no detalhe R1 e foram revalidados. Chrome aprovou QuickTask/EditTask em `320x844`, `360x800`, `390x844` e desktop; RegisterTimeEntry também, com desktop `512x444` centralizado. Automação final: 268 passed, 0 failed, 0 skipped; typecheck, lint, build e diff-check aprovados. Estados error/empty e teclado virtual físico não foram reproduzidos manualmente. A frente responsiva fica tecnicamente encerrada com essa limitação registrada; Attachments funcional permanece pendente independente.
