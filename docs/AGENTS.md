# AGENTS.md — Instruções para agentes de IA no Orbis

## 1. Objetivo deste documento

Este arquivo define as regras de desenvolvimento que agentes de IA devem seguir ao trabalhar no Orbis.

O Orbis será desenvolvido do zero como uma aplicação web multiempresa para gestão de requisições de software, tarefas, capacidade da equipe, Kanban, timelines, sistemas, versões, releases, funcionários, permissões, notificações e comunicação interna.

A documentação complementar está em:

- `docs/ai_context.md`: contexto rápido e decisões fundamentais.
- `docs/ai_handoff.md`: estado atual do projeto e próximo passo recomendado.
- `docs/architecture.md`: arquitetura detalhada e decisões estruturais.

## 2. Regra de nomenclatura mais importante

O sistema original utilizava o termo **ordem**.

No Orbis, o termo oficial é sempre:

> **Requisição**

Nunca introduzir `Order`, `OrderService`, `orderId`, `ordem`, `ordens` ou equivalentes para representar esse conceito de negócio.

Use:

- `Requisition`
- `requisitionId`
- `requisitions`
- `Requisicao` somente quando um identificador em português for inevitável.

O termo `task` representa uma **tarefa de execução** dentro do trabalho da equipe e não deve ser confundido com uma requisição.

Uma requisição pode possuir tarefas.

## 3. Escopo funcional

O sistema deve contemplar, progressivamente:

1. autenticação e autorização;
2. empresas/tenants;
3. usuários e funcionários;
4. permissões;
5. sistemas;
6. versões de sistemas;
7. releases/executáveis vinculados a versões;
8. requisições;
9. tarefas;
10. Kanban;
11. timeline semanal;
12. timeline mensal e anual;
13. cálculo de capacidade e previsão;
14. apontamento de horas;
15. histórico/auditoria;
16. notificações configuráveis;
17. chat interno;
18. relatórios;
19. dashboards;
20. anexos em requisições e tarefas (imagens, PDFs e links para documentações externas).

A especificação original exige Kanban com colunas personalizáveis, ex.: `A Fazer`, `Em Andamento`, `Pausado` e `Concluído`, mas podem ser totalmente editáveis pelos usuarios autorizados,  timeline semanal e timeline mensal/anual. Também exige cálculo de previsão com base na capacidade dos programadores, registro de pausas, conclusão, atrasos e filtros. Esses requisitos são obrigatórios e devem ser preservados.

A timeline mensal/anual deve apresentar título, número da requisição, prioridade, horas, datas de início, previsão e entrega real, além de filtros e indicadores.

### Requisito visual e de experiência (imprescindível)

É uma regra imprescindível do produto:

- o app deve ser **totalmente responsivo em aparelhos móveis** (mobile-first), sem degradação funcional em nenhuma tela (Kanban, timelines, formulários, relatórios, chat);
- o app deve ter um **visual elegante e tecnológico**, consistente e coerente com a identidade do produto;
- o app deve ser **totalmente personalizável por usuário** em aparência (tema claro/escuro, cor de destaque, densidade visual etc.);
- as preferências de aparência devem persistir por usuário e acompanhá-lo entre dispositivos;
- tema, cores e responsividade pertencem à camada de apresentação. O domínio não conhece CSS, nomes de cores ou temas; o mapeamento de conceitos de domínio (ex.: prioridade) para estilos é responsabilidade da UI (ver §17).

## 4. Stack obrigatória

### Backend

- Node.js
- TypeScript
- Fastify
- Drizzle ORM
- PostgreSQL
- Redis somente quando houver necessidade real
- Zod para validação de entrada/saída
- JWT para autenticação
- WebSocket para recursos em tempo real, especialmente chat e notificações quando aplicável

### Frontend

- React
- Vite
- TypeScript
- shadcn/ui
- Tailwind CSS

A personalização de aparência por usuário é um requisito do produto; bibliotecas complementares de tema podem ser adicionadas somente com necessidade real e justificada.

Bibliotecas adicionais devem ser justificadas pela necessidade da funcionalidade.

Não adicionar dependências apenas por conveniência.

## 5. Monorepo lógico

O repositório deve possuir duas aplicações independentes:

```text
/
├── API/
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   └── ...
│
├── app/
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   └── ...
│
├── docs/
└── ...
```

`API` e `app` possuem:

- `package.json` próprio;
- dependências próprias;
- TypeScript próprio;
- scripts próprios;
- build próprio;
- testes próprios.

Não criar um workspace compartilhado prematuramente.

Se no futuro surgir necessidade de compartilhar tipos ou contratos, criar um pacote explicitamente separado e justificar a decisão.

## 6. Princípios de arquitetura

Aplicar Clean Architecture e princípios de Clean Code sem transformar a aplicação em abstrações artificiais.

Regra principal:

> Regra de negócio não depende de framework, banco, HTTP, React ou infraestrutura.

### Backend

Dependências devem apontar para dentro:

```text
HTTP / WebSocket
      ↓
Interface / Controller
      ↓
Application / Use Cases
      ↓
Domain
      ↑
Infrastructure implementa portas
      ↓
PostgreSQL / Redis / Storage / serviços externos
```

O domínio não deve importar:

- Fastify;
- Drizzle;
- Zod;
- Redis;
- JWT;
- bibliotecas de HTTP;
- bibliotecas específicas de infraestrutura.

### Frontend

Separar:

```text
UI / Pages
   ↓
Feature application hooks / actions
   ↓
Use cases / domain rules
   ↓
Ports / API clients
   ↓
HTTP
```

Componentes React não devem concentrar regras de negócio.

## 7. Estrutura recomendada do backend

A estrutura inicial deve seguir módulos de negócio:

```text
API/src/
├── main.ts
├── app.ts
├── config/
├── shared/
│   ├── domain/
│   ├── application/
│   ├── errors/
│   ├── logging/
│   └── utils/
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
    ├── database/
    ├── cache/
    ├── storage/
    ├── realtime/
    └── security/
```

Dentro de cada módulo, preferir:

```text
module/
├── domain/
│   ├── entities/
│   ├── value-objects/
│   ├── repositories/
│   └── services/
├── application/
│   ├── use-cases/
│   ├── dto/
│   └── ports/
├── infrastructure/
│   ├── repositories/
│   └── mappers/
└── presentation/
    ├── http/
    └── websocket/
```

Não criar todas essas pastas se o módulo ainda for pequeno. A estrutura deve crescer junto com o domínio.

## 8. Estrutura recomendada do frontend

```text
app/src/
├── app/
│   ├── router/
│   ├── providers/
│   └── layouts/
├── components/
│   ├── ui/
│   └── common/
├── features/
│   ├── auth/
│   ├── requisitions/
│   ├── tasks/
│   ├── kanban/
│   ├── timeline/
│   ├── capacity/
│   ├── systems/
│   ├── employees/
│   ├── notifications/
│   ├── chat/
│   └── settings/
├── pages/
├── domain/
├── lib/
├── services/
├── hooks/
├── types/
└── main.tsx
```

Cada feature deve manter próximo de si:

- componentes específicos;
- hooks;
- schemas;
- tipos;
- mapeadores;
- chamadas de API;
- testes.

Não transformar `components/` em depósito de componentes de negócio.

## 9. Multiempresa / multitenancy

O sistema deve ser projetado como SaaS multiempresa desde o início.

Conceito:

```text
Company = Tenant
User   = identidade global
Membership = vínculo User ↔ Company
```

Um usuário poderá, se necessário, participar de mais de uma empresa.

Toda operação sobre dados pertencentes a uma empresa deve validar o `companyId` no contexto autenticado.

Nunca confiar em um `companyId` enviado pelo frontend sem validar que o usuário possui acesso à empresa.

Entidades tenant-owned devem possuir referência à empresa quando aplicável.

Exemplos:

- funcionários;
- sistemas;
- versões;
- releases;
- requisições;
- tarefas;
- notificações;
- conversas;
- relatórios.

Evitar misturar dados de tenants.

A implementação inicial pode utilizar isolamento por `company_id` na camada de aplicação e constraints no banco. PostgreSQL Row Level Security pode ser introduzido posteriormente se a necessidade operacional justificar.

## 10. Autenticação e autorização

Usar JWT.

Preferência:

- access token de curta duração;
- refresh token com rotação;
- refresh token armazenado de forma segura;
- invalidação/revogação;
- senha armazenada apenas com hash seguro;
- nunca armazenar senha em texto puro.

Autorização deve ser baseada em permissões.

Exemplos de permissões:

```text
company.read
company.update
users.read
users.manage
permissions.manage
systems.read
systems.manage
versions.manage
releases.manage
requisitions.read
requisitions.create
requisitions.update
requisitions.delete
tasks.read
tasks.create
tasks.update
tasks.delete
kanban.manage
timeline.manage
capacity.read
hours.register
notifications.manage
chat.use
audit.read
```

A lista acima é inicial, não um contrato definitivo.

## 11. Permissões do Kanban e timeline

A especificação exige que o controle do dashboard possa existir no nível da empresa e do próprio funcionário. fileciteturn0file0L29-L35

Portanto, não usar apenas uma flag global.

O modelo deve permitir:

- política padrão da empresa;
- permissões específicas por função;
- permissões específicas de usuário quando necessário;
- possibilidade de o funcionário gerenciar seu próprio quadro, sem necessariamente poder alterar o quadro global;
- controle de quem pode mover, editar, criar e excluir tarefas.

A autorização deve ser verificada no backend, mesmo que a UI esconda ações não permitidas.

## 12. Requisições e tarefas

### Requisição

Representa a demanda formal de trabalho.

Pode possuir:

- título;
- identificador/número;
- prioridade;
- descrição/observações;
- solicitante;
- responsável/equipe;
- sistema;
- versão relacionada quando aplicável;
- estimativa de horas;
- data de início;
- previsão;
- data de entrega;
- status;
- histórico.

### Tarefa

Representa uma unidade executável de trabalho no Kanban.

Uma tarefa pode estar vinculada a uma requisição, mas isso não é obrigatório.

Status inicial:

```text
TODO
IN_PROGRESS
PAUSED
DONE
```

Não criar estados adicionais sem necessidade de negócio documentada.

### 12.1 Anexos de requisições e tarefas

Requisições e tarefas podem possuir anexos de dois tipos:

- **arquivos**: imagens, PDFs e documentos em geral — persistidos **no próprio PostgreSQL** (BYTEA em tabela dedicada `attachment_blobs`); o banco armazena tanto os metadados quanto o conteúdo;
- **links**: URLs para documentações externas — persistidos apenas como metadados no banco.

Regras:

- o upload valida tipo (whitelist) e tamanho no backend; nunca confiar em `fileName`/`mimeType` informados pelo cliente;
- todo anexo é tenant-owned e segue as permissões da entidade pai (`requisitions.*` / `tasks.*`);
- anexo não altera status nem capacidade da tarefa/requisição (é um enriquecimento, não um estado);
- os binários usam BYTEA com limite de tamanho (recomendação inicial: 10 MB por arquivo); a análise completa das abordagens está em `docs/architecture.md §17.2`;
- listar metadados nunca carrega o `bytea`; gravação e remoção de metadados + blob são atômicas.

## 13. Kanban

O Kanban deve possuir quatro colunas padrão:

1. A Fazer;
2. Em Andamento;
3. Pausado;
4. Concluído.

A especificação exige drag and drop para avançar/retroceder e ações de iniciar/pausar. fileciteturn0file0L37-L50

Mudanças de status devem ser registradas em histórico.

Exemplo:

```text
TODO → IN_PROGRESS
IN_PROGRESS → PAUSED
PAUSED → IN_PROGRESS
IN_PROGRESS → DONE
```

Não registrar somente o estado atual. O histórico é necessário para auditoria e métricas.

## 14. Pausas e apontamento de horas

Quando uma tarefa for pausada:

- registrar início da pausa.

Ao retomar:

- registrar fim da pausa;
- calcular duração.

Não sobrescrever pausas anteriores.

Preferir uma tabela de intervalos de trabalho/pausa ou eventos imutáveis.

Horas trabalhadas devem ser registradas separadamente da estimativa.

Nunca substituir `estimatedHours` por `workedHours`.

## 15. Cálculo de capacidade

A regra funcional original é:

```text
capacidade diária =
  programadores disponíveis × horas diárias por programador

dias necessários =
  horas necessárias / capacidade diária

data prevista =
  data inicial + dias úteis necessários
```

Essa regra deve ficar em um serviço de domínio puro, testável sem banco ou HTTP. fileciteturn0file0L11-L15

A implementação deve considerar:

- finais de semana;
- feriados configuráveis;
- disponibilidade individual;
- férias/ausências quando o domínio suportar;
- capacidade efetiva da equipe;
- horas já comprometidas, quando o planejamento exigir.

Não alterar a fórmula silenciosamente. Se a regra evoluir para considerar carga já ocupada, documentar a nova regra.

## 16. Datas e timezone

No backend:

- armazenar instantes em UTC quando representarem momento;
- armazenar datas de calendário sem horário como `date` quando apropriado;
- nunca usar `Date` indiscriminadamente para datas de negócio;
- definir timezone da empresa para cálculos de calendário.

A previsão deve ser calculada no timezone da empresa.

## 17. Prioridades

Prioridades:

```text
LOW
MEDIUM
HIGH
```

Mapeamento visual:

- HIGH → vermelho;
- MEDIUM → laranja;
- LOW → verde.

A cor é responsabilidade da apresentação. O domínio não deve depender de classes CSS ou nomes de cores.

## 18. Timeline

### Semanal

A timeline semanal mostra as tarefas e os dias da semana, posicionando o trabalho de acordo com as datas. Tarefa pausada deve possuir diferenciação visual. fileciteturn0file0L53-L57

### Mensal

Mostrar:

- dias do mês;
- requisições;
- previsão;
- atraso;
- ordenação por data.

### Anual

Mostrar:

- meses;
- marcadores;
- quantidade por mês;
- agrupamento por prioridade;
- expansão para detalhes.

Filtros:

- prioridade;
- responsável;
- status;
- mês;
- ano.

## 19. Sistemas, versões e releases

O domínio de software deve possuir:

```text
System
  └── Version
        └── Release
```

Uma release deve estar vinculada a uma versão.

Não armazenar executáveis diretamente no PostgreSQL.

Persistir metadados da release, como:

- nome;
- versão;
- tipo/canal;
- caminho/chave do artefato;
- checksum;
- tamanho;
- data;
- status.

O armazenamento físico deve ser abstraído por uma porta, permitindo:

- filesystem local em desenvolvimento;
- storage S3-compatible ou equivalente em produção.

Esta porta destina-se apenas a releases/executáveis. Anexos de requisições e tarefas **não** usam esta porta: são armazenados no próprio PostgreSQL (BYTEA em tabela dedicada, ver §12.1 e `docs/architecture.md §17.2`).

## 20. Notificações

Notificações devem ser configuráveis por usuário.

O usuário poderá configurar, conforme os tipos definidos pelo sistema:

- receber ou não;
- canal;
- eventos de interesse.

Tipos iniciais possíveis:

```text
REQUISITION_ASSIGNED
TASK_ASSIGNED
TASK_STATUS_CHANGED
TASK_DUE_SOON
TASK_OVERDUE
REQUISITION_COMPLETED
MENTION
CHAT_MESSAGE
RELEASE_PUBLISHED
```

A lista pode evoluir.

Não colocar regras de notificação diretamente dentro dos controllers.

Preferir eventos de domínio/aplicação + serviço de notificações.

## 21. Chat interno

O chat é interno ao tenant.

Requisitos:

- conversas entre usuários;
- mensagens persistidas;
- histórico;
- timestamps;
- leitura/não leitura;
- tempo real quando possível.

WebSocket pode ser utilizado para entrega em tempo real.

PostgreSQL é a fonte de verdade.

Redis não deve substituir o banco de mensagens.

Redis pode ser usado como:

- pub/sub;
- adapter para múltiplas instâncias da API;
- cache de dados apropriados.

## 22. Redis

Redis é opcional.

Não adicionar Redis apenas porque a aplicação possui muitos usuários.

Usar quando houver necessidade concreta de:

- cache;
- rate limiting distribuído;
- pub/sub;
- sessões efêmeras;
- presença online;
- filas.

A aplicação deve continuar conceitualmente correta sem Redis.

## 23. Banco de dados

PostgreSQL é a fonte de verdade.

Drizzle deve ficar na infraestrutura.

Regras:

- migrations versionadas;
- foreign keys;
- índices adequados;
- unique constraints;
- check constraints quando fizer sentido;
- timestamps;
- soft delete somente quando houver requisito real;
- transações em operações que alteram múltiplas entidades;
- binários de anexos em `bytea` numa tabela dedicada (`attachment_blobs`), com limite de tamanho e leitura isolada da listagem de metadados.

Não fazer queries SQL espalhadas pelos use cases.

## 24. API

A API deve seguir recursos e ações de negócio claras.

Exemplos:

```text
POST   /auth/login
POST   /auth/refresh
POST   /auth/logout

GET    /companies
GET    /companies/:companyId

GET    /requisitions
POST   /requisitions
GET    /requisitions/:id
PATCH  /requisitions/:id
DELETE /requisitions/:id

POST   /tasks
PATCH  /tasks/:id/status
POST   /tasks/:id/pause
POST   /tasks/:id/resume
POST   /tasks/:id/complete

GET    /timeline/weekly
GET    /timeline/monthly
GET    /timeline/yearly

GET    /capacity
POST   /time-entries

GET    /notifications
PATCH  /notification-preferences

GET    /conversations
POST   /conversations/:id/messages

POST   /requisitions/:id/attachments
GET    /requisitions/:id/attachments
DELETE /requisitions/:id/attachments/:attachmentId

POST   /tasks/:id/attachments
GET    /tasks/:id/attachments
DELETE /tasks/:id/attachments/:attachmentId
```

Os endpoints finais devem ser definidos conforme os use cases.

## 25. Validação

Toda entrada externa deve ser validada.

Frontend:

- validação para UX.

Backend:

- validação obrigatória;
- backend é a autoridade.

Nunca confiar em:

- IDs vindos do cliente;
- permissões vindas do cliente;
- `companyId`;
- status;
- datas calculadas pelo frontend;
- valores de capacidade.

## 26. Tratamento de erros

Não usar `try/catch` indiscriminadamente.

Criar erros de aplicação/domínio tipados.

Exemplos:

```text
NotFoundError
UnauthorizedError
ForbiddenError
ValidationError
ConflictError
BusinessRuleError
```

O HTTP layer traduz esses erros para status HTTP.

Não retornar stack traces ao cliente em produção.

## 27. Clean Code

Preferir:

- funções pequenas;
- nomes explícitos;
- responsabilidade única;
- baixo acoplamento;
- alta coesão;
- composição;
- dependências injetadas;
- interfaces somente quando representam uma porta real.

Evitar:

- classes gigantes;
- services genéricos como `CommonService`;
- `utils.ts` gigantes;
- `helpers.ts` sem contexto;
- abstrações criadas apenas para "seguir Clean Architecture";
- duplicação de regra;
- lógica de negócio em componentes;
- lógica de negócio em controllers.

## 28. Frontend

O frontend deve:

- usar React apenas para apresentação/orquestração;
- centralizar chamadas HTTP em clients/services;
- manter regras de negócio fora de componentes visuais;
- usar shadcn/ui como primitives;
- usar Tailwind para composição visual;
- manter acessibilidade;
- ser **totalmente responsivo em aparelhos móveis** (mobile-first), incluindo Kanban, timelines, formulários, relatórios e chat;
- ter **visual elegante e tecnológico**, consistente por meio de um design system (shadcn/ui) e de tokens de tema (Tailwind);
- ser **totalmente personalizável por usuário** em aparência (tema claro/escuro, cor de destaque, densidade), com preferências persistidas por usuário;
- manter estados de loading/error/empty.

Tema, cores e responsividade são responsabilidade da apresentação. O domínio não conhece CSS, nomes de cores ou temas (o mapeamento prioridade → cor segue `docs/architecture.md §17`).

Não colocar `fetch()` diretamente em dezenas de componentes.

## 29. Estado no frontend

Separar:

- estado de servidor;
- estado de UI;
- estado de formulário;
- estado de autenticação.

Não criar um Context global gigante.

Usar a ferramenta adequada somente após necessidade comprovada.

## 30. Testes

Obrigatórios para regras críticas:

### Backend

- cálculo de capacidade;
- cálculo de dias úteis;
- previsão de entrega;
- transições de status;
- pausas;
- permissões;
- isolamento entre empresas;
- autenticação;
- casos de conflito.

### Frontend

- componentes críticos;
- filtros;
- formulários;
- estados do Kanban;
- timeline;
- regras de apresentação derivadas do domínio.

Testes de integração devem validar banco e API nos módulos críticos.

## 31. Segurança

Nunca:

- commitar secrets;
- expor JWT secret;
- logar tokens;
- logar senhas;
- confiar em autorização do frontend;
- permitir acesso cross-tenant;
- aceitar upload sem validação.

Implementar:

- rate limiting onde necessário;
- CORS restritivo;
- headers de segurança;
- validação de payload;
- controle de tamanho de upload;
- auditoria de ações administrativas.

## 32. Auditoria

Ações sensíveis devem gerar auditoria:

- login relevante;
- alteração de permissões;
- alteração de empresa;
- criação/alteração/exclusão de requisição;
- alteração de status;
- publicação de release;
- alteração de configurações.

Auditoria deve identificar:

- usuário;
- empresa;
- ação;
- entidade;
- identificador;
- timestamp;
- metadados mínimos.

## 33. Regras para agentes de IA

Antes de alterar código:

1. ler `docs/AGENTS.md`;
2. ler `docs/ai_context.md`;
3. consultar `docs/architecture.md`;
4. consultar `docs/ai_handoff.md`;
5. inspecionar o código existente da área;
6. entender dependências;
7. propor a menor mudança coerente.

Não inventar arquivos ou APIs já existentes.

Não reescrever módulos inteiros sem necessidade.

Não alterar arquitetura global para resolver um problema local.

## 34. Ordem recomendada de implementação

1. fundação dos projetos `API` e `app`;
2. PostgreSQL + Drizzle + migrations;
3. configuração e ambiente;
4. empresas e memberships;
5. autenticação;
6. autorização;
7. usuários/funcionários;
8. sistemas/versões/releases;
9. requisições;
10. tarefas;
11. Kanban;
12. apontamento/pausas;
13. capacidade e previsão;
14. timeline semanal;
15. timeline mensal/anual;
16. notificações;
17. chat;
18. relatórios;
19. auditoria;
20. hardening, observabilidade e deploy.

A dashboard mensal/anual deve ser implementada depois das bases de requisição, tarefa, capacidade e calendário estarem estáveis, conforme a solicitação original. fileciteturn0file0L70-L94

## 35. Definition of Done

Uma funcionalidade não está concluída apenas porque funciona na tela.

Antes de considerar concluída:

- regra de negócio está no lugar correto;
- autorização existe no backend;
- isolamento multiempresa foi validado;
- validação de entrada existe;
- tratamento de erros existe;
- testes relevantes existem;
- migration existe quando necessário;
- frontend trata loading/error/empty;
- não há dependência desnecessária;
- build passa;
- testes passam;
- documentação foi atualizada quando a decisão arquitetural mudou.

## 36. Regra final

Se houver conflito entre:

1. segurança;
2. isolamento entre empresas;
3. regra de negócio documentada;
4. arquitetura;
5. conveniência de implementação;

priorizar nessa ordem.

Quando houver dúvida de negócio não resolvida, não inventar comportamento silenciosamente. Registrar a dúvida em `docs/ai_handoff.md` ou solicitar decisão antes de consolidar uma regra estrutural.
