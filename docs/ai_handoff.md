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
- Próxima menor unidade: M11.6B4B — lookup de Attachments sob demanda.

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
- Attachments ainda não possuem client, query keys, queries ou UI no frontend.

## Próximo passo

M11.6B4B deve implementar lookup de Attachments sob demanda, somente metadados, quando o detalhe de uma Task está aberto. Backend continua sendo a autoridade. Não implementar upload, remoção, download, autofill, customização de colunas, Board estrutural, reorder ou novos statuses.
