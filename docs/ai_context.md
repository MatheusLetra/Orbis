# AI Context — Orbis

## 1. Resumo

Orbis é uma plataforma web de gestão de desenvolvimento de software.

O objetivo é reconstruir do zero uma solução originalmente solicitada para gerenciamento de tarefas e planejamento da equipe, transformando-a em um produto multiempresa capaz de ser utilizado pela empresa atual e futuramente vendido para outras empresas.

O conceito central é **Requisição**. O termo "ordem" da especificação original não deve aparecer como conceito do sistema.

A especificação exige Kanban, timeline semanal, timeline mensal/anual, prioridades, pausas, responsáveis, registro de conclusão, relatórios e cálculo de previsão baseado em capacidade. fileciteturn0file0L29-L67

## 2. Stack

### API

- Node.js
- TypeScript
- Fastify
- Drizzle ORM
- PostgreSQL
- Redis opcional
- JWT
- Zod
- WebSocket quando necessário
- Documentação de API via **Scalar** (`@scalar/fastify-api-reference`) + `@fastify/swagger` — **todo endpoint deve ser documentado** (UI em `/reference`)

### App

- React
- Vite
- TypeScript
- shadcn/ui
- Tailwind CSS

`API` e `app` são aplicações independentes, cada uma com `package.json`, dependências, TypeScript, scripts e build próprios.

O `app` possui requisitos visuais imprescindíveis:

- **responsividade mobile completo** (mobile-first) em todas as telas;
- **visual elegante e tecnológico**, consistente via design system (shadcn/ui) e tokens de tema (Tailwind);
- **personalização total de aparência por usuário** (tema claro/escuro, cor de destaque, densidade), persistida por usuário.

## 3. Arquitetura

Clean Architecture modular.

### API

```text
API/src/
├── config/
├── shared/
├── modules/
│   ├── auth/
│   ├── companies/
│   ├── users/
│   ├── permissions/
│   ├── systems/
│   ├── requisitions/
│   ├── tasks/
│   ├── capacity/
│   ├── notifications/
│   ├── chat/
│   └── audit/
└── infrastructure/
```

Dependência:

```text
Presentation → Application → Domain
Infrastructure → implementa portas do Application/Domain
```

### App

```text
app/src/
├── app/
├── components/
├── features/
├── pages/
├── domain/
├── services/
├── hooks/
├── lib/
└── types/
```

Componentes React não são o local das regras de negócio.

## 4. Multiempresa

`Company` representa o tenant.

`User` representa uma identidade global.

`Membership` representa o vínculo entre usuário e empresa.

Um usuário pode futuramente pertencer a mais de uma empresa.

Dados tenant-owned devem ser isolados por `companyId`.

O backend sempre valida o tenant a partir do contexto autenticado.

Nunca confiar em `companyId` enviado pelo frontend.

## 5. Domínios

### Empresa

- dados cadastrais;
- configurações;
- timezone;
- política do dashboard;
- calendário/feriados quando aplicável.

### Usuário/funcionário

- identidade;
- credenciais;
- perfil;
- **cargo** — posição/função do funcionário dentro da empresa, ex.: `ADMINISTRADOR`, `GESTOR`, `SUPORTE`, `TESTADOR`, `DESENVOLVEDOR`, entre outros. O cargo é um atributo funcional de RH e não deve ser confundido com roles/permissões de autorização;
- vínculo com empresa;
- disponibilidade/capacidade;
- permissões;
- preferências de aparência (tema, cor de destaque, densidade).

### Sistema

Representa um software/produto administrado pela empresa.

### Versão

Pertence a um sistema.

### Release

Pertence a uma versão e representa um executável/artefato publicado.

O executável não deve ficar no PostgreSQL. O banco guarda metadados e uma referência ao storage.

### Requisição

É a demanda formal de trabalho.

Uma requisição pode conter:

- título;
- número;
- prioridade;
- descrição;
- solicitante;
- responsável;
- equipe;
- sistema;
- versão;
- horas estimadas;
- início;
- previsão;
- entrega;
- status.

### Tarefa

É uma unidade de trabalho executável.

Pode estar ligada a uma requisição.

Estados padrão:

```text
TODO
IN_PROGRESS
PAUSED
DONE
```

### Anexo

Requisições e tarefas podem possuir anexos:

- arquivos (imagens, PDFs, documentos) — persistidos **no próprio PostgreSQL** (BYTEA em tabela dedicada `attachment_blobs`); o banco é a fonte de verdade dos metadados e do conteúdo;
- links para documentações externas — apenas metadados.

O anexo é tenant-owned e segue as permissões da entidade pai. Não afeta status nem capacidade. Limite de tamanho por arquivo é aplicado no backend.

### Apontamento

Registra horas efetivamente trabalhadas.

Estimativa e horas realizadas são conceitos diferentes.

### Pausa

Representa um intervalo de pausa de uma tarefa.

Nunca sobrescrever pausas anteriores.

## 6. Kanban

Quatro colunas padrão:

```text
A Fazer
Em Andamento
Pausado
Concluído
```

A especificação exige:

- drag and drop;
- iniciar com um clique;
- pausar com um clique;
- edição;
- pesquisa;
- criação rápida;
- responsável pré-preenchido;
- busca de requisição para preencher dados. fileciteturn0file0L41-L50

Toda mudança de status deve ser auditável.

## 7. Timeline

### Semanal

Mostra tarefas e dias da semana.

### Mensal

Mostra requisições/tarefas por dias do mês, previsão, atrasos e ordenação.

### Anual

Mostra meses, marcadores, contadores e agrupamento por prioridade.

Filtros:

- prioridade;
- responsável;
- status;
- mês;
- ano.

A solicitação original também prevê indicadores como horas planejadas, capacidade usada, quantidade por prioridade e percentual entregue no prazo. fileciteturn0file0L86-L94

## 8. Capacidade

Regra inicial:

```text
capacidade diária =
  programadores disponíveis × horas diárias por programador

dias necessários =
  horas necessárias / capacidade diária

data prevista =
  data inicial + dias úteis necessários
```

Essa regra deve ser implementada como serviço de domínio puro e testada isoladamente.

A evolução futura pode considerar capacidade já comprometida, férias, feriados e disponibilidade individual.

## 9. Prioridade

Valores:

```text
LOW
MEDIUM
HIGH
```

Apresentação:

```text
HIGH   → vermelho
MEDIUM → laranja
LOW    → verde
```

O domínio não conhece CSS.

## 10. Notificações

Cada usuário pode configurar quais tipos de eventos deseja receber.

A arquitetura deve permitir múltiplos canais sem acoplar o domínio ao provedor.

Notificações devem ser disparadas por eventos/use cases, não por componentes ou controllers.

## 11. Chat

Chat interno por empresa.

Persistência no PostgreSQL.

WebSocket para tempo real.

Redis é opcional para pub/sub e escala horizontal.

PostgreSQL continua sendo a fonte de verdade.

## 12. Segurança

- JWT com access token curto;
- refresh token com rotação (revoga o anterior a cada uso);
- hash seguro de senha (scrypt);
- hash do refresh token no banco (SHA-256 — token nunca armazenado em texto puro);
- autorização no backend;
- isolamento tenant;
- validação de payload;
- validação de upload de arquivos (tipo e tamanho);
- rate limiting;
- CORS;
- auditoria;
- secrets fora do Git.

Implementado no M4: `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`; rotas de negócio protegidas por `Authorization: Bearer <access token>`.

## 13. Banco

PostgreSQL é a fonte de verdade.

Inclui os binários dos anexos de requisições/tarefas (BYTEA em tabela dedicada, com limite de tamanho e TOAST gerenciando valores grandes).

Drizzle fica somente na infraestrutura.

Migrations versionadas.

Usar índices, constraints, foreign keys e transações adequadamente.

## 14. Regras de nomenclatura

Nunca usar "order" para o conceito de negócio.

Use:

```text
requisition
requisitionId
requisitions
```

Use `task` somente para tarefa.

Nomes de tabelas devem preferencialmente ser plural em snake_case:

```text
companies
users
memberships
refresh_tokens
requisitions
tasks
task_status_history
time_entries
systems
system_versions
releases
notifications
notification_preferences
conversations
messages
```

## 15. Primeiro objetivo técnico

Construir a fundação sem tentar implementar toda a interface imediatamente:

1. criar `API`;
2. criar `app`;
3. configurar TypeScript;
4. configurar Fastify;
5. configurar React/Vite;
6. configurar shadcn/Tailwind;
7. configurar PostgreSQL;
8. configurar Drizzle;
9. criar migrations;
10. criar health checks;
11. criar configuração de ambiente;
12. criar primeiro fluxo de autenticação;
13. criar tenant/membership;
14. criar autorização.

Depois disso, avançar por domínio.

## 15.1 Requisitos transversais de qualidade

- **Documentação de API obrigatória**: todo endpoint da API deve ser documentado via Scalar (`@scalar/fastify-api-reference` + `@fastify/swagger`); UI em `GET /reference`, spec em `/reference/openapi.json` e `/reference/openapi.yaml`.
- **Cobertura de testes obrigatória**: `API/` e `app/` devem ter cobertura se aproximando de **100%** (unitários, integração, API, frontend), rodada via `npm run test:coverage` com thresholds no `vitest.config.ts`.
- **Registro no plano de implementação**: toda implementação deve ser registrada em `docs/PLANO-IMPLEMENTACAO.md`, mantendo o processo contínuo e retomável.
- **README na raiz**: a cada etapa concluída, gerar/atualizar o `README.md` com explicação do projeto e instruções de execução.

## 16. Fonte funcional

A solicitação anexada é a fonte dos requisitos funcionais originais.

O bloco de dashboard de tarefas define Kanban, timeline semanal, pausa, retomada, conclusão e relatório. fileciteturn0file0L29-L67

O bloco de timeline define cálculo de previsão, timeline mensal/anual, filtros, indicadores e operações sobre requisições. fileciteturn0file0L70-L94

Os requisitos adicionais definidos para o novo Orbis são:

- multiempresa;
- sistemas;
- versões;
- releases/executáveis;
- anexos em requisições e tarefas (imagens, PDFs e links externos);
- funcionários;
- permissões;
- autenticação JWT;
- notificações configuráveis por usuário;
- chat interno;
- Clean Code;
- Clean Architecture;
- backend separado em `API`;
- frontend separado em `app`.

## 17. Regra transversal: visual, responsividade e personalização

É requisito imprescindível do produto e vale para qualquer tela/feature:

1. **Responsividade total em mobile** — mobile-first em Kanban, timelines, formulários, relatórios e chat; nenhuma funcionalidade pode ficar inacessível no aparelho móvel.
2. **Visual elegante e tecnológico** — consistência via design system (shadcn/ui) e tokens de tema (Tailwind), sem estilos improvisados por feature.
3. **Personalização por usuário** — tema claro/escuro, cor de destaque e densidade visual configuráveis por usuário, persistidos por usuário (para acompanhá-lo entre dispositivos quando a identidade existir).

Esses requisitos pertencem à camada de apresentação. O domínio não conhece CSS, cores ou temas.

