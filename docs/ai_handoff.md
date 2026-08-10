# AI Handoff — Orbis

## Status atual

**Projeto em fase de arquitetura / bootstrap.**

O Orbis ainda não deve ser tratado como uma migração incremental do sistema antigo. A intenção é construir um produto novo, com arquitetura preparada para múltiplas empresas.

A especificação funcional original foi analisada e convertida para o conceito de **Requisição**. O termo "ordem" não deve ser utilizado no novo domínio.

## Decisões já tomadas

### Stack

Backend:

- Node.js
- TypeScript
- Fastify
- Drizzle
- PostgreSQL
- Redis opcional

Frontend:

- React
- Vite
- TypeScript
- shadcn/ui
- Tailwind

### Estrutura de aplicações

```text
/
├── API/
├── app/
└── docs/
```

Não criar um monorepo de pacotes compartilhados neste primeiro momento.

## Decisões arquiteturais

### Backend

Clean Architecture modular:

```text
presentation
    ↓
application
    ↓
domain

infrastructure
    ↓
implementa portas
```

O domínio não conhece Fastify, Drizzle, PostgreSQL, Redis ou JWT.

### Frontend

Arquitetura orientada a features.

Componentes visuais não devem conter regras de negócio.

Requisitos visuais imprescindíveis:

- **totalmente responsivo em mobile** (mobile-first) em todas as telas;
- **visual elegante e tecnológico** via design system (shadcn/ui) e tokens de tema (Tailwind);
- **personalização total por usuário** (tema claro/escuro, cor de destaque, densidade), persistida por usuário.

### Multiempresa

```text
User
  │
  ├── Membership ── Company A
  └── Membership ── Company B
```

O usuário é global.

Os dados de negócio são tenant-aware.

## Modelo de domínio inicial

```text
Company
 ├── Membership
 │    └── User
 │
 ├── System
 │    └── SystemVersion
 │          └── Release
 │
 ├── Requisition
 │    ├── Attachment
 │    └── Task
 │          ├── StatusHistory
 │          ├── PauseIntervals
 │          ├── TimeEntries
 │          └── Attachment
 │
 ├── Notification
 ├── NotificationPreference
 ├── Conversation
 │    └── Message
 └── AuditLog
```

Este diagrama é conceitual e não representa ainda o schema final.

## Pontos que precisam permanecer consistentes

### Requisição ≠ tarefa

Uma requisição é uma demanda.

Uma tarefa é trabalho executável.

Não misturar esses conceitos para simplificar a implementação.

### Estimativa ≠ horas realizadas

`estimatedHours` indica planejamento.

`workedHours`/time entries indicam execução.

### Previsão ≠ entrega real

A data prevista é calculada.

A data de entrega real é registrada quando a execução termina.

### Status atual ≠ histórico

O estado atual é necessário para consulta rápida.

O histórico é necessário para auditoria, métricas e timeline.

## Regra de capacidade

Implementar inicialmente:

```text
dailyCapacity = availableDevelopers * dailyHoursPerDeveloper

requiredDays = estimatedHours / dailyCapacity

plannedDeliveryDate =
  addBusinessDays(startDate, requiredDays)
```

Arredondamento e regra exata de inclusão do dia inicial devem ser definidos no serviço de domínio e cobertos por testes.

Não implementar essa regra diretamente em controller, query SQL ou componente React.

## Questões ainda abertas

Estas decisões não devem ser inventadas silenciosamente:

1. Um usuário pode pertencer a várias empresas?
   - A arquitetura já está preparada para isso.
   - Comportamento de UX ainda precisa ser definido.

2. Qual o conjunto final de roles?
   - A autorização deve ser permission-based.
   - Roles podem ser presets.

3. Funcionário e usuário serão entidades diferentes?
   - Recomendação: identidade `User` + perfil/membership de funcionário.
   - **REQUISITO DOCUMENTADO:** o cadastro de funcionários deve possuir o campo **cargo** (posição/função na empresa), com cargos iniciais como `Administrador`, `Gestor`, `Suporte`, `Testador`, `Desenvolvedor`, etc. O cargo é atributo funcional de RH; a autorização continua baseada em permissões (cargo não substitui roles/permissões).
   - A decisão final deve acompanhar o modelo de RH desejado.

4. Qual storage será usado para executáveis (releases)?
   - Dev: filesystem pode ser suficiente.
   - Produção: storage S3-compatible é recomendado.
   - Criar uma porta para não acoplar o domínio.
   - **DECIDIDO:** anexos de requisições/tarefas (imagens, PDFs e links) NÃO usam essa porta — ficam no próprio PostgreSQL, em BYTEA numa tabela dedicada (`attachment_blobs`), com limite de tamanho por arquivo. Análise e vereditos em `docs/architecture.md §17.2`.

5. Quais canais de notificação serão suportados inicialmente?
   - In-app é o primeiro candidato.
   - Email/push podem ser adicionados sem alterar o domínio.

6. Feriados serão globais ou por empresa?
   - O requisito de dias úteis torna esse ponto importante.
   - Modelar de forma que possa ser configurado por empresa.

7. Como calcular capacidade quando um programador estiver parcialmente comprometido com outras requisições?
   - A fórmula inicial é simples.
   - Planejamento por carga já ocupada pode ser uma segunda versão.

8. Como persistir as preferências de aparência (tema, cor, densidade)?
   - Requisito imprescindível: personalização total por usuário.
   - Recomendação: persistir por usuário via API (acompanha entre dispositivos), com fallback temporário em armazenamento local enquanto a identidade não existir.
   - A decisão final deve acompanhar o modelo de identidade (questão 3).

## Primeiro milestone recomendado

### Milestone 0 — Fundação

Criar:

```text
API/
app/
docs/
```

Configurar:

- Node;
- TypeScript strict;
- Fastify;
- React/Vite;
- Tailwind;
- shadcn/ui;
- design system e tokens de tema (claro/escuro, cor de destaque, densidade);
- base responsiva mobile-first;
- PostgreSQL;
- Drizzle;
- migrations;
- variáveis de ambiente;
- logger;
- tratamento de erros;
- health check;
- lint;
- testes.

### Milestone 1 — Identidade e tenant

Implementar:

- company;
- user;
- membership;
- **cargo do funcionário** (posição/função na empresa, ex.: `Administrador`, `Gestor`, `Suporte`, `Testador`, `Desenvolvedor`, etc.) — atributo funcional de RH, distinto de roles/permissões;
- roles/policies;
- login;
- refresh;
- logout;
- autorização;
- seleção de empresa.

### Milestone 2 — Catálogo de software

Implementar:

- systems;
- versions;
- releases;
- storage abstraction.

### Milestone 3 — Requisições

Implementar:

- CRUD;
- prioridade;
- responsável;
- equipe;
- sistema;
- versão;
- estimativa;
- datas;
- histórico.

### Milestone 3.5 — Anexos de requisições e tarefas

Implementar:

- tabelas `attachments` (metadados) e `attachment_blobs` (BYTEA) e domínio de anexos;
- anexo de arquivos (imagens, PDFs, documentos) no próprio PostgreSQL, com limite de tamanho;
- anexo de links (documentação externa) como metadados;
- validação de tipo e tamanho no backend;
- endpoints de anexos em requisições e tarefas (upload, listagem, download, remoção);
- exibição dos anexos no detalhe da requisição/tarefa (card no Kanban), responsive e no tema do usuário.

### Milestone 4 — Tarefas e Kanban

Implementar:

- CRUD;
- quatro status;
- drag and drop;
- iniciar;
- pausar;
- retomar;
- concluir;
- histórico;
- pausas;
- apontamento.

### Milestone 5 — Capacidade e timeline semanal

Implementar:

- disponibilidade;
- horas diárias;
- dias úteis;
- previsão;
- timeline semanal;
- filtros.

### Milestone 6 — Timeline mensal/anual

Implementar somente depois da capacidade estar confiável.

A especificação original marca a dashboard mensal/anual como etapa a ser feita por último. fileciteturn0file0L70-L94

### Milestone 7 — Notificações e chat

Implementar:

- preferências;
- notificações in-app;
- WebSocket;
- conversas;
- mensagens;
- read/unread.

### Milestone 8 — Relatórios e auditoria

Implementar:

- relatório de tarefas;
- filtros;
- auditoria;
- métricas.

## Critério para iniciar cada milestone

Antes de iniciar um milestone:

1. ler `AGENTS.md`;
2. ler `ai_context.md`;
3. ler `architecture.md`;
4. verificar este handoff;
5. inspecionar o código atual;
6. listar decisões que possam ser afetadas;
7. implementar somente o necessário.

## Critério de conclusão

Uma feature somente está pronta quando:

- backend está protegido por autorização;
- tenant isolation está validado;
- regra de negócio possui testes;
- API possui validação;
- frontend possui estados de loading/error/empty;
- migrations estão versionadas;
- documentação está coerente;
- build passa;
- testes passam.

## Próxima ação recomendada para o agente

Começar pelo bootstrap das duas aplicações e pela infraestrutura mínima.

Não iniciar pelo Kanban ou pela timeline.

A primeira entrega deve ser capaz de subir localmente:

```text
PostgreSQL
API
app
```

e responder:

```text
GET /health
```

com a aplicação React acessível no navegador.

Depois disso, iniciar o domínio de autenticação + empresa + membership.
