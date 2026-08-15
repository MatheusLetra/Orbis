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
| 21 | [M21 - Painel administrativo](milestones/M21.md) | Em andamento; checkpoint parcial, não aprovada |

## Decisões atuais

- PostgreSQL é a fonte de verdade e migrations são aplicadas por `cd API && npm run db:migrate`.
- Attachments FILE continuam em `attachment_blobs.data BYTEA`; LINKs são metadados.
- Releases não têm storage: somente `artifactLocation` textual, sem download binário.
- O runtime não implementa WebSocket, polling, EventSource, Redis ou storage externo.
- Coverage, typecheck, lint, builds e auditoria Playwright são gates de qualidade; não reduzir thresholds nem mascarar falhas.
- `commands/` permanece intocado e inexistente.

## Cobertura de produto

O roadmap registra entregas por escopo, não uma promessa de painel administrativo completo. As rotas frontend atuais são `/login`, `/`, `/kanban`, `/timeline`, `/timeline/monthly`, `/timeline/yearly`, `/reports` e `/chat`. Não existe painel administrativo formal.

M21 foi formalmente iniciada e está em checkpoint parcial. Endpoints administrativos e uma implementação frontend inicial existem no worktree, mas PostgreSQL real sem skips, gates globais e Playwright ainda não foram aprovados. Portanto, nenhuma superfície M21 deve ser considerada concluída. O estado retomável está em [`milestones/M21.md`](milestones/M21.md).

Backlog administrativo sugerido, sujeito a aprovação formal: Company Administration; Users/Memberships; Requisitions; Systems/Versions; Releases; Audit.

## Regra de avanço

Antes de iniciar ou retomar uma milestone, ler o arquivo correspondente, validar código/testes/schema/OpenAPI e executar a auditoria automatizada em browser quando houver superfície aplicável. Registrar decisões, comandos reais, artifacts e pendências no handoff. Para M21, retomar pela validação PostgreSQL real do backend descrita no checkpoint; não avançar ao Playwright global antes dos gates intermediários.
