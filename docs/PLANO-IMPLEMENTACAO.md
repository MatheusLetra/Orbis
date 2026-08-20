# Plano de Implementação - Orbis

Este arquivo é o índice do roadmap. O detalhe histórico está em [`milestones/`](milestones/), e o estado operacional atual está em [`ai_handoff.md`](ai_handoff.md).

## Milestones

| Ordem | Milestone | Status |
|---|---|---|
| 1 | [M01 - Fundação](milestones/M01.md) | Concluída |
| 2 | [M02 - Infraestrutura de dados](milestones/M02.md) | Concluída |
| 3 | [M03 - Núcleo compartilhado](milestones/M03.md) | Concluída |
| 4 | [M04 - Identidade](milestones/M04.md) | Concluída |
| 5 | [M05 - Autenticação JWT](milestones/M05.md) | Concluída |
| 6 | [M06 - Autorização](milestones/M06.md) | Concluída |
| 7 | [M07 - Catálogo](milestones/M07.md) | Concluída |
| 8 | [M08 - Requisições](milestones/M08.md) | Concluída |
| 9 | [M09 - Tasks e histórico](milestones/M09.md) | Concluída |
| 10 | [M10 - Attachments](milestones/M10.md) | Concluída |
| 11 | [M11 - Kanban](milestones/M11.md) | Concluída |
| 12 | [M12 - Pausas e horas](milestones/M12.md) | Concluída |
| 13 | [M13 - Capacity](milestones/M13.md) | Concluída |
| 14 | [M14 - Timeline semanal](milestones/M14.md) | Concluída |
| 15 | [M15 - Timelines mensal/anual](milestones/M15.md) | Concluída |
| 16 | [M16 - Notifications](milestones/M16.md) | Concluída |
| 17 | [M17 - Chat](milestones/M17.md) | Concluída |
| 18 | [M18 - Reports](milestones/M18.md) | Concluída |
| 19 | [M19 - Audit](milestones/M19.md) | Concluída |
| 20 | [M20 - Hardening, observabilidade e deploy](milestones/M20.md) | Concluída |
| 21 | [M21 - Painel administrativo](milestones/M21.md) | Concluída e aprovada |

## Decisões atuais

- PostgreSQL é a fonte de verdade e migrations são aplicadas por `cd API && npm run db:migrate`.
- Attachments FILE continuam em `attachment_blobs.data BYTEA`; LINKs são metadados.
- Releases não têm storage: somente `artifactLocation` textual, sem download binário.
- O runtime não implementa WebSocket, polling, EventSource, Redis ou storage externo.
- Coverage, typecheck, lint, builds e auditoria Playwright são gates de qualidade; não reduzir thresholds nem mascarar falhas.
- `commands/` permanece intocado e inexistente.

## Cobertura de produto

O roadmap registra entregas por escopo. M21 adicionou as rotas administrativas `/admin/*` com gates por capability, sem inventar fluxos MASTER, storage de Releases ou operações sem endpoint.

M21 foi concluída após PostgreSQL real serial sem skips, cobertura, gates de API/app e Playwright específico/global. O detalhamento está em [`milestones/M21.md`](milestones/M21.md).

Não existe atualmente uma próxima milestone numerada ou formalmente aprovada. M22 não foi iniciada. O backlog futuro abaixo é informativo e não representa escopo implementado nem bloqueio operacional.

## Correções pós-M21 concluídas

- Permissões: resposta compatível, persistência confirmada, refetch tenant-aware, pending/anti-duplicação, preservação em erro e mensagens HTTP/rede.
- Requisitions: datas de calendário aceitas e criação de Task vinculada no detalhe com invalidação tenant-aware.
- Tasks: criação pelo Kanban e pelo detalhe de Requisition envia `startDate`/`plannedEndDate` como `YYYY-MM-DD`; o backend persiste PostgreSQL `date` sem deslocamento e o card/detalhe exibem as datas.
- Causa raiz investigada no browser: a mutation `useCreateTask` descartava descrição e datas ao converter a chamada legada para `tasksClient.create`; os inputs e o backend estavam corretos. A correção foi limitada ao fallback da mutation, preservando calendário `YYYY-MM-DD`, null/ausência e validação de intervalo.
- Navegação global: Início, Voltar, breadcrumb administrativo e controles acessíveis em mobile.
- Status de Task: corrigida apenas a projeção/UI de transições aprovadas; `DONE` continua terminal e não foi criada transição para `TODO`.
- Testes unitários, HTTP, cobertura e Playwright global executados após os gates.

Reabrir `DONE` e criar `IN_PROGRESS -> TODO` continuam decisões pendentes e bloqueantes.

### Validação da correção de datas

- API: 1042/1042 testes com PostgreSQL real serial; coverage 96,59% statements, 90,04% branches, 97,25% functions e 97,70% lines.
- App: 681/681 testes; coverage 95,53% statements, 90,08% branches, 95,72% functions e 96,60% lines.
- Browser: reprodução inicial real falha em `artifacts/browser-audit/2026-08-20T19-26-54-776Z-4173d9d6-6710-4a9c-8431-c9c755d6cc8a/`; validação dedicada Kanban/Requisition aprovada em `artifacts/browser-audit/2026-08-20T19-35-06-427Z-66286401-c23a-460f-bf80-4ca8355048dc/`, com request body, resposta, refetch, card, detalhe, screenshot, trace e PostgreSQL; auditoria global final aprovada em `artifacts/browser-audit/2026-08-20T19-46-29-924Z-b189f745-028f-4d23-83fe-3f686957d65d/`.
- Typecheck, lint, builds, `npx tsc -p tsconfig.json --noEmit` e `git diff --check` aprovados. Nenhuma migration foi criada; Tasks, Requisitions, Timeline, Attachments, Releases, Capacity, Notifications, Chat, Reports e `commands/` foram preservados fora do necessário.
- Status final da correção de datas: aprovado após reprodução no browser real e confirmação serial no PostgreSQL. Kanban sem Requisition e criação dentro da Requisition persistem e exibem `20/08/2026` a `25/08/2026`; a diferença `plannedDeliveryDate` permanece exclusiva de Requisition e não é usada no DTO de Task.

## Backlog futuro pós-M21

### Notifications Lifecycle

- `TASK_DUE_SOON` e `TASK_OVERDUE`;
- regras de destinatários e timezone;
- scheduler, idempotência, concorrência e locks;
- retenção, expiração e limpeza;
- somente in-app inicialmente.

### Tempo real e canais

- WebSocket, SSE ou polling;
- reconexão, recuperação de mensagens e autorização de conexão;
- e-mail, push, templates e preferências de canais.

### Chat e administração

- `CHAT_MESSAGE`, presença, menções, anexos, edição/remoção e tempo real;
- ativação/inativação de Company, User/Membership;
- reset/convite de senha;
- bootstrap/promoção MASTER;
- administração avançada de permissões.

### Operações

- retenção de Notifications/Audit/refresh tokens;
- expiração, limpeza e deduplicação avançada;
- filas/outbox, locks distribuídos, métricas e tracing adicionais.

Nenhum item está implementado ou aprovado. O runtime atual permanece HTTP-only, PostgreSQL é a fonte da verdade, não há WebSocket, scheduler, e-mail, push ou storage externo, Releases usam `artifactLocation` e Attachments permanecem em PostgreSQL BYTEA.

## Regra de avanço

Antes de iniciar uma milestone, ler o arquivo correspondente, validar código/testes/schema/OpenAPI e executar a auditoria automatizada em browser quando houver superfície aplicável. Registrar decisões, comandos reais, artifacts e pendências no handoff.
