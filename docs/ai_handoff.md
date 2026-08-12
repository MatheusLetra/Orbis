# AI Handoff — Orbis

## Estado atual

**M08 — Requisições: CONCLUÍDA.** Próxima milestone do roadmap: M09 — Tarefas e histórico de status.

Entregues: entidade `Requisition`, CRUD completo, vínculo de responsável e equipe, repositories Drizzle, geração atômica e sequencial de `number` por empresa, composição no composition root, endpoints HTTP documentados via OpenAPI, isolamento tenant, permissões `requisitions.*`, `TestModules`/fakes e testes PostgreSQL.

Última tarefa concluída: validação PostgreSQL e encerramento formal da M08.

As milestones anteriores M01–M07 estão concluídas conforme `docs/PLANO-IMPLEMENTACAO.md`.

## Decisões relevantes

- O domínio permanece independente de Fastify, Drizzle, PostgreSQL, Redis e HTTP.
- `companyId` sempre vem do contexto autenticado e não é confiado ao cliente.
- `requesterId` de uma nova requisição vem de `actor.userId`.
- `number` não vem do cliente e é sequencial por empresa.
- Status de requisição: `OPEN`, `IN_PROGRESS`, `PAUSED`, `DONE`, `CANCELLED`.
- Prioridades: `LOW`, `MEDIUM`, `HIGH`.
- `responsibleId` é o responsável principal e é independente da equipe.
- `requisition_assignees` representa equipe adicional; o responsável pode também ser membro.
- `GetRequisition` retorna `RequisitionDetailOutput` com `assignees`.
- `ListRequisitions` retorna `RequisitionOutput[]` sem carregar equipe.

## Geração de number

`requisition_number_counters` mantém uma linha por empresa. `DrizzleRequisitionNumberGenerator.next(companyId)` usa `INSERT ... ON CONFLICT DO UPDATE ... RETURNING`, é concorrente-seguro, começa em `1`, aceita gaps e não reutiliza números consumidos.

## Contratos e arquivos principais

- Use cases: `create-requisition.ts`, `update-requisition.ts`, `list-requisitions.ts`, `get-requisition.ts`, `delete-requisition.ts`, `add-requisition-assignee.ts`, `remove-requisition-assignee.ts`, `list-requisition-assignees.ts`.
- DTOs: `API/src/modules/requisitions/application/dto/requisition-dtos.ts`.
- Repositories: `DrizzleRequisitionRepository` e `DrizzleRequisitionAssigneeRepository`.
- Generator: `API/src/modules/requisitions/infrastructure/numbering/drizzle-requisition-number-generator.ts`.
- HTTP: `API/src/modules/requisitions/http/requisition.routes.ts`.
- Composition: `API/src/infrastructure/composition-root.ts`.
- Filtros oficiais da lista: `status`, `priority` e `responsibleId`; sem paginação ou busca textual.

## Arquivos principais

- `API/src/modules/requisitions/domain/entities/requisition.ts`
- `API/src/modules/requisitions/application/dto/requisition-dtos.ts`
- `API/src/modules/requisitions/application/ports/requisition-number-generator.ts`
- `API/src/modules/requisitions/application/use-cases/create-requisition.ts`
- `API/src/modules/requisitions/application/use-cases/update-requisition.ts`
- `API/src/modules/requisitions/application/use-cases/list-requisitions.ts`
- `API/src/modules/requisitions/domain/repositories/requisition-repository.ts`
- `API/src/modules/requisitions/infrastructure/numbering/drizzle-requisition-number-generator.ts`
- `API/src/infrastructure/database/schema.ts`
- `API/src/infrastructure/database/migrations/0003_massive_blizzard.sql`

## Verificações

- Testes relacionados de Requisitions: **128 passed**, **0 skipped**, em **13 arquivos**.
- Testes PostgreSQL passaram, incluindo repositories concretos, isolamento, filtros, assignees e geração concorrente de `number`.
- Lint e `git diff --check` passam.
- Typecheck permanece bloqueado somente pelo erro preexistente em `API/src/infrastructure/composition-root.ts`, que importa o módulo ausente `@/modules/releases/infrastructure/storage/local-artifact-storage`. Não corrigir neste contexto.

## Estado da M08

Não há pendências funcionais ou de integração da M08. `responsibleId` permanece independente de `requisition_assignees`; `GetRequisition` retorna `assignees` e `ListRequisitions` não carrega equipe. Os filtros oficiais são `status`, `priority` e `responsibleId`.

O erro de `local-artifact-storage` é preexistente, pertence ao módulo de releases e não pertence à M08.

## Próxima milestone

M09 — Tarefas e histórico de status.

## Primeira ação recomendada

Ler `docs/milestones/M09.md` e inspecionar o estado atual dos módulos de identidade, autorização e Requisitions antes de iniciar a implementação de `Task`.
