# Plano de Implementação — Orbis

Este documento funciona como índice e roadmap das milestones do Orbis. O conteúdo operacional de cada milestone está no respectivo arquivo em [`milestones/`](milestones/).

## Ordem das milestones

| Ordem | Milestone | Arquivo | Status |
|---|---|---|---|
| 1 | M01 — Fundação dos projetos | [M01.md](milestones/M01.md) | Concluída |
| 2 | M02 — Infraestrutura de dados | [M02.md](milestones/M02.md) | Concluída |
| 3 | M03 — Núcleo compartilhado | [M03.md](milestones/M03.md) | Concluída |
| 4 | M04 — Identidade: empresas, usuários e memberships | [M04.md](milestones/M04.md) | Concluída |
| 5 | M05 — Autenticação JWT | [M05.md](milestones/M05.md) | Concluída |
| 6 | M06 — Autorização por permissões | [M06.md](milestones/M06.md) | Concluída |
| 7 | M07 — Catálogo de software | [M07.md](milestones/M07.md) | Concluída |
| 8 | M08 — Requisições | [M08.md](milestones/M08.md) | Próxima etapa recomendada |
| 9 | M09 — Tarefas e histórico de status | [M09.md](milestones/M09.md) | Não iniciada |
| 10 | M10 — Anexos de requisições e tarefas | [M10.md](milestones/M10.md) | Não iniciada |
| 11 | M11 — Kanban | [M11.md](milestones/M11.md) | Não iniciada |
| 12 | M12 — Pausas e apontamento de horas | [M12.md](milestones/M12.md) | Não iniciada |
| 13 | M13 — Capacidade e previsão | [M13.md](milestones/M13.md) | Não iniciada |
| 14 | M14 — Timeline semanal | [M14.md](milestones/M14.md) | Não iniciada |
| 15 | M15 — Timeline mensal/anual | [M15.md](milestones/M15.md) | Não iniciada |
| 16 | M16 — Notificações | [M16.md](milestones/M16.md) | Não iniciada |
| 17 | M17 — Chat | [M17.md](milestones/M17.md) | Não iniciada |
| 18 | M18 — Relatórios | [M18.md](milestones/M18.md) | Não iniciada |
| 19 | M19 — Auditoria | [M19.md](milestones/M19.md) | Não iniciada |
| 20 | M20 — Hardening, observabilidade e deploy | [M20.md](milestones/M20.md) | Não iniciada |

## Dependências resumidas

```text
M01 → M02 → M03 → M04 → M05 → M06 → M07
                         └──────→ M08 → M09 → M10 → M11
M06 → M13 → M14 → M15
M09 → M12
M04/M05 → M16 → M17
M09/M12/M13 → M18
M04/M05/M06 → M19
Todas → M20
```

## Regras de execução

- Executar as milestones na ordem indicada, respeitando suas dependências.
- Consultar o arquivo da milestone antes de iniciar sua execução.
- Registrar decisões ambíguas como **A confirmar**, sem inventar comportamento.
- Aplicar às milestones as regras transversais já documentadas em `AGENTS.md`, `ai_context.md` e `architecture.md`.
