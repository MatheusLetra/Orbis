# Orbis

Plataforma web multiempresa para requisições, Tasks, Kanban, capacidade, timelines, relatórios, notificações, chat e auditoria.

Este README é o índice operacional. Os procedimentos completos estão em [`docs/USER_MANUAL.md`](docs/USER_MANUAL.md) e [`docs/DEVELOPER_MANUAL.md`](docs/DEVELOPER_MANUAL.md).

## Estado atual

- M01 a M10: concluídas.
- M11: concluída.
- M12: concluída.
- M13: concluída.
- M14: concluída.
- M15: concluída.
- M16: concluída.
- M17: concluída.
- M18: concluída.
- M19: concluída.
- M20: concluída.
- M21: concluída e aprovada após os gates de backend, PostgreSQL real, frontend e browser.

O estado detalhado e as decisões atuais estão em [`docs/ai_handoff.md`](docs/ai_handoff.md). O roadmap está em [`docs/PLANO-IMPLEMENTACAO.md`](docs/PLANO-IMPLEMENTACAO.md).

## Cobertura de produto versus API

M01-M20 foram concluídas conforme seus escopos. Isso pode incluir domínio, backend, API, testes ou uma superfície frontend específica; não significa que todos os módulos administrativos tenham UI.

- Endpoint não equivale a tela.
- Client, fixture ou teste não equivale a tela.
- As rotas frontend incluem `/admin`, `/admin/companies`, `/admin/users`, `/admin/requisitions`, `/admin/systems`, `/admin/versions`, `/admin/releases` e `/admin/audit`, além das rotas operacionais existentes.
- O painel administrativo é tenant-aware e protegido por capabilities; criação de empresa, bootstrap MASTER e operações sem contrato continuam API-only.
- Releases continuam usando somente `artifactLocation` textual, sem storage ou download binário.

Operações administrativas disponíveis somente pela API devem ser tratadas como API-only, não como funções disponíveis na interface.

## Documentação

- [Manual do usuário](docs/USER_MANUAL.md)
- [Manual do desenvolvedor](docs/DEVELOPER_MANUAL.md)
- [Arquitetura](docs/architecture.md)
- [Handoff](docs/ai_handoff.md)
- [Plano de implementação](docs/PLANO-IMPLEMENTACAO.md)
- [Regras para agentes](docs/AGENTS.md)
- [Contexto de IA](docs/ai_context.md)
- [Operação M20](docs/operations/M20.md)
- [Milestones M01-M20](docs/milestones/)

## Arquitetura e tecnologias

`API/` e `app/` são aplicações independentes. A API usa Node.js, TypeScript, Fastify, Drizzle, PostgreSQL, Zod, Pino, JWT e Scalar/OpenAPI. O app usa React, Vite, TypeScript, React Router, React Query, Tailwind, shadcn/ui, dnd-kit e Vitest. Auditorias de browser usam Playwright.

O backend segue Presentation -> Application -> Domain; Infrastructure implementa as portas. O isolamento é tenant-aware por `companyId`, validado no backend. PostgreSQL é a fonte de verdade. Chat e notificações usam HTTP explícito e persistência; WebSocket, polling, EventSource e Redis não estão implementados.

Estrutura principal:

```text
API/src/{config,shared,modules,infrastructure}
app/src/{app,components,features,lib}
audit/{scripts,specs,fixtures}
docs/{milestones,operations}
```

## Execução local

Pré-requisitos: Node.js 20+ (a imagem oficial usa Node 22), npm, Docker e PostgreSQL quando não for usado o container fornecido.

```bash
cd API
docker build -f Dockerfile.postgres -t orbis-db .
docker run --name orbis-postgres -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=orbis -p 5432:5432 -d orbis-db
cp .env.example .env
npm install
npm run db:migrate
npm run dev
```

Em outro terminal:

```bash
cd app
cp .env.example .env
npm install
npm run dev
```

API: `http://localhost:3333`. App: `http://localhost:5173`.

Health e documentação:

```bash
curl http://localhost:3333/health
curl http://localhost:3333/health/live
curl http://localhost:3333/health/ready
```

Scalar: `http://localhost:3333/reference`. OpenAPI: `/reference/openapi.json` e `/reference/openapi.yaml`.

Para o banco puro, use `postgres:17-alpine` e depois `cd API && npm run db:migrate`. Migrations repetidas são idempotentes pelo journal do Drizzle. Não existe comando oficial de reset.

## Usuário inicial

Não existe seed, script, endpoint MASTER ou credencial padrão oficial. `POST /users` cria uma identidade global; depois do login, `POST /companies` cria uma empresa e uma membership `GESTOR` para o usuário autenticado. O cargo `ADMINISTRADOR` existe como preset de permissões, mas não há fluxo automatizado chamado MASTER. Consulte a seção correspondente no manual do desenvolvedor; nunca use senha fixa ou texto puro.

## Scripts

No diretório `API/`: `npm run dev`, `npm run build`, `npm start`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:coverage`, `npm run db:generate`, `npm run db:migrate`, `npm run db:studio`.

No diretório `app/`: `npm run dev`, `npm run build`, `npm run preview`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:coverage`.

Na raiz: `npm install`, `npm run audit:install`, `npm run audit:browser`, `npm run audit:m21`, `npm run audit:browser:headed`, `npm run audit:responsive`, `npm run audit:attachments`, `npm run audit:time-entries`, `npm run audit:capacity`, `npm run audit:notifications`, `npm run audit:chat`, `npm run audit:timeline`, `npm run audit:timeline-monthly`, `npm run audit:reports` e `npm run audit:m20`.

Os detalhes, diretórios e limitações estão em [`docs/DEVELOPER_MANUAL.md`](docs/DEVELOPER_MANUAL.md). A auditoria de browser é serial (`workers: 1`) e gera artefatos em `artifacts/browser-audit/`.

## Testes e cobertura

```bash
cd API && npm test
cd API && npm run test:coverage
cd app && npm test
cd app && npm run test:coverage
```

Os thresholds são definidos nos dois `vitest.config.ts`: 95% para statements/functions/lines e 90% para branches. O estado M20 validado foi API 1027/1027 e app 632/632, com coverage API 96,59%/90,05%/97,17%/97,71% e app 95,72%/90,54%/96,33%/96,85% (statements/branches/functions/lines). PostgreSQL real é executado serialmente; Playwright M20 foi 1/1 e global 57/57.

## Docker, backup e storage

Há `API/Dockerfile` e `app/Dockerfile`. O procedimento de backup/restore PostgreSQL isolado, com RPO 24h, RTO 4h e retenção técnica de sete backups diários, está em [`docs/operations/M20.md`](docs/operations/M20.md).

Attachments FILE usam `attachments` + `attachment_blobs.data BYTEA` no PostgreSQL, com metadados, checksum SHA-256, leitura sob demanda e sem BYTEA nas listas. LINK guarda somente metadados.

Releases usam somente `artifactLocation` textual. O Orbis não armazena, baixa, valida, calcula checksum ou resolve o artefato; não há filesystem, S3/provider ou download binário de Release.

## Segurança e limites

Access token JWT fica em memória no app. Refresh token usa cookie HttpOnly, rotação e hash no banco. Em produção, segredos fortes e `FRONTEND_ORIGIN` HTTPS são obrigatórios. Não commite `.env`, tokens, senhas ou backups.

Limites relevantes: upload de Attachment até 10 MB; TimeEntry de 1 a 1440 minutos; mensagem de chat de 1 a 5000 caracteres; CSV de Reports até 10.000 Tasks; cursor e filtros seguem OpenAPI.

## Troubleshooting

- `/health/live` falha: verifique o processo da API e a porta 3333.
- `/health/ready` retorna 503: verifique `DATABASE_URL`, PostgreSQL e migrations.
- Login falha: confirme `VITE_API_URL`, `FRONTEND_ORIGIN`, cookie e origem do navegador.
- Banco limpo: aplique `cd API && npm run db:migrate`; não execute SQL de produção manualmente.
- Testes PostgreSQL: execute a suíte serialmente e use um banco isolado.
- Playwright: execute `npm run audit:install` antes da primeira auditoria.

## Contribuição e auditoria

Mudanças devem preservar contratos, autorização, tenant isolation, Attachments e `artifactLocation`. Atualize o plano, a documentação relevante e os testes. Antes de avançar uma milestone, execute a auditoria automatizada obrigatória em browser e registre o resultado. M21 foi concluída; a próxima milestone ainda depende de definição formal.
