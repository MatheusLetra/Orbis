# AI Handoff — Orbis

## Estado atual

**Milestone atual: M08 — Requisições.**

Concluídas nesta milestone:

- entidade de domínio `Requisition`;
- infraestrutura de geração sequencial de `number`;
- `CreateRequisition`;
- `UpdateRequisition`;
- `ListRequisitions`.

Última tarefa concluída: `ListRequisitions`.

Ainda pendentes em M08:

- `GetRequisition`;
- `DeleteRequisition`;
- vínculo de responsáveis/equipe (`requisition_assignees`);
- integração final do repository concreto;
- endpoints de requisições;
- conclusão formal dos critérios de API, filtros, isolamento e permissões.

As milestones anteriores M01–M07 estão concluídas conforme `docs/PLANO-IMPLEMENTACAO.md`.

## Decisões relevantes

- O domínio permanece independente de Fastify, Drizzle, PostgreSQL, Redis e HTTP.
- `companyId` sempre vem do contexto autenticado e não é confiado ao cliente.
- `requesterId` de uma nova requisição vem de `actor.userId`.
- `number` não vem do cliente e é sequencial por empresa.
- Status de requisição: `OPEN`, `IN_PROGRESS`, `PAUSED`, `DONE`, `CANCELLED`.
- Prioridades: `LOW`, `MEDIUM`, `HIGH`.
- Alterações de status ainda não possuem máquina de estados implementada.

## Geração de number

Foi criada a tabela `requisition_number_counters`, com uma linha por empresa:

- `company_id` é a chave primária e referencia `companies` com `ON DELETE CASCADE`;
- `last_number` é `integer NOT NULL`;
- a primeira chamada retorna `1`;
- chamadas seguintes usam `INSERT ... ON CONFLICT DO UPDATE ... RETURNING`;
- a operação é concorrente-segura;
- gaps são aceitos e números consumidos não são reutilizados;
- a porta é `RequisitionNumberGenerator.next(companyId)`.

Migration: `API/src/infrastructure/database/migrations/0003_massive_blizzard.sql`.

## Contratos de requisições

### CreateRequisition

- Command: `actor` e `data`.
- `companyId`, `requesterId`, `number` e `status` não entram no input.
- Fluxo valida contexto, permissão `requisitions.create`, membership, payload e referências antes de chamar o number generator.
- `responsibleId`, `systemId` e `systemVersionId` são validados no tenant.
- Quando sistema e versão são informados, a versão deve pertencer ao sistema.

### UpdateRequisition

- Command: `actor`, `requisitionId` e `changes`.
- PATCH usa `undefined` para preservar, valor para substituir e `null` para remover campos opcionais.
- `companyId`, `number`, `requesterId`, `createdAt` e `status` permanecem imutáveis.
- Não há transições de status nem regras adicionais de datas.
- O estado efetivo é validado antes da persistência.

### ListRequisitions

- Command: `actor` e `filters?`.
- Filtros oficiais: `status`, `priority` e `responsibleId`.
- `companyId`, `requesterId`, `systemId`, `systemVersionId`, `number`, mês, ano e busca textual não fazem parte do contrato.
- Não há paginação.
- A ordenação padrão é `createdAt` ascendente e não é configurável pelo cliente.
- O repository recebe sempre `actor.companyId`.

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

Executados com sucesso:

- testes da entidade `Requisition`;
- testes de `CreateRequisition`;
- testes de `UpdateRequisition`;
- testes de `ListRequisitions`;
- testes estruturais do schema;
- lint da API;
- `git diff --check`.

Estado geral dos testes relacionados: **52 aprovados**. Cinco testes de integração PostgreSQL foram pulados porque o banco de teste não estava disponível.

O typecheck permanece bloqueado por erro preexistente em `API/src/infrastructure/composition-root.ts`, que importa o módulo ausente `@/modules/releases/infrastructure/storage/local-artifact-storage`. Não corrigir neste contexto.

## Próxima ação

Implementar `GetRequisition`, sem iniciar `DeleteRequisition`, endpoints ou `requisition_assignees`.
