# AI Handoff — Orbis

## Projeto
Orbis é uma aplicação multiempresa de gestão de requisições e tarefas.

- API independente em TypeScript/Node.js.
- Fastify, PostgreSQL, Drizzle ORM, Zod, JWT e OpenAPI/Scalar.
- Arquitetura modular com separação entre apresentação, aplicação, domínio e infraestrutura.

## Forma de trabalho
O desenvolvimento ocorre milestone por milestone:

1. analisar o estado atual;
2. identificar a próxima unidade de trabalho;
3. produzir prompt quando solicitado;
4. executar no agente;
5. analisar o relatório;
6. repetir;
7. auditar antes de encerrar milestones relevantes.

Relatórios de agentes são evidências relatadas e devem ser analisados, não aceitos automaticamente.

## PLAN / BUILD
PLAN é investigação, auditoria, análise, desenho e definição sem alteração de código.

BUILD é implementação, correção, refactor aprovado, testes e documentação.

Não usar BUILD para auditoria read-only nem PLAN quando a tarefa definida exige modificar o projeto.

## Modelos
- GPT-5.6 Luna: tarefas delimitadas, implementação comum, documentação e correções moderadas.
- GPT-5.6 Sol: investigação ou implementação de maior complexidade, ambiguidade ou risco arquitetural.

Considerar custo e limites; não recomendar Sol quando Luna for suficiente.

## Erro preexistente
O typecheck permanece bloqueado pelo erro preexistente relacionado a `local-artifact-storage`.

Esse erro pertence a Releases, não às milestones M09/M10. Não corrigir, contornar ou modificar sem solicitação explícita.

## M09 — Tasks
**Concluída.**

Inclui domínio `Task`, histórico imutável, criação, atualização, transições, listagem, consulta, repositories Drizzle, Unit of Work transacional, endpoints HTTP, composição e fakes.

Decisões essenciais:
- status inicial `TODO`;
- criação registra `null → TODO`;
- `PAUSED → DONE` é proibido;
- `DONE` é terminal;
- histórico append-only;
- status usa `SELECT ... FOR UPDATE`;
- operações são tenant-aware.

Evidências finais conhecidas: Tasks 112 testes aprovados; PostgreSQL específico 11/11 passed, 0 skipped; lint e `git diff --check` aprovados. O typecheck só falha pelo erro preexistente de `local-artifact-storage`.

## M10 — Attachments
**Concluída.**

Garantias essenciais:
- Attachment imutável FILE/LINK;
- owner exclusivo Requisition ou Task;
- metadata separada de `attachment_blobs` em PostgreSQL `BYTEA`;
- MIME detectado por magic bytes;
- whitelist PDF/JPEG/PNG/GIF/WebP;
- SHA-256 e tamanho calculados sobre o Buffer real;
- limite de 1 byte a 10 MB;
- filename seguro e URL LINK normalizada;
- atomicidade metadata/blob FILE com Unit of Work;
- rollback e cascades PostgreSQL;
- isolamento por tenant e autorização herdada do parent;
- membership ativa exigida;
- cinco use cases e dez rotas HTTP;
- download valida blob, tamanho e checksum;
- composição root e TestModules integrados.

Contratos HTTP fechados:
- upload FILE aceita somente field `file` e title opcional;
- partes inesperadas, arquivo ausente, title duplicado, field name incorreto e múltiplos arquivos retornam 400;
- arquivo acima de 10 MB retorna 413;
- upload FILE é documentado como multipart com file binário obrigatório, title opcional e `additionalProperties: false`;
- owner é documentado como união discriminada Requisition/Task;
- download usa MIME persistido, tamanho real e Content-Disposition seguro;
- inconsistência `sizeBytes !== data.length` retorna 422.

Evidências finais:
- testes HTTP: 7 passed, 0 skipped;
- suíte M10 sem banco: 77 passed, 13 skipped exclusivamente por PostgreSQL condicional;
- PostgreSQL real: 13 passed, 0 skipped com `TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5433/orbis_test`;
- lint aprovado;
- `git diff --check` aprovado;
- typecheck bloqueado somente pelo erro preexistente de `local-artifact-storage`.

Não há pendências bloqueantes. Permanece apenas a melhoria opcional de teste PostgreSQL explícito para checksum e `sizeBytes` após restauração.

## Estado atual
- M09 concluída.
- M10 concluída.
- M11 ainda não iniciada.
- Próxima milestone: **M11 — Kanban**.

## Próximo passo
A próxima sessão deve começar pela análise da especificação e do roadmap existentes de M11. Não assumir requisitos ausentes e não iniciar implementação antes de compreender o escopo documentado.
