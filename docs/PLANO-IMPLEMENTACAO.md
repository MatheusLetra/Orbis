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
