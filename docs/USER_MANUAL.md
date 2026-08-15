# Manual do Usuário

## Como começar

Abra `/login`, informe as credenciais fornecidas pelo administrador e entre. O usuário precisa existir e estar ativo. A sessão usa o navegador; ao sair, use **Sair** no cabeçalho. Não há recuperação de senha implementada na interface.

O cabeçalho permite trocar a empresa ativa quando o usuário possui mais de uma membership e alternar o tema. A empresa ativa altera todas as consultas; respostas de outra empresa não são reutilizadas. O layout é responsivo, mas o Kanban usa rolagem horizontal intencional no celular.

O produto não possui painel administrativo formal. A seleção de empresa não é cadastro de empresa: criar, editar, ativar/inativar, alterar timezone, gerenciar usuários ou configurar capacidade persistida não estão disponíveis na interface.

## Rotas disponíveis

| Rota | Função |
|---|---|
| `/login` | Login |
| `/` | Empresa ativa, simulação de capacidade e informações da empresa |
| `/kanban` | Tasks e Kanban |
| `/timeline` | Timeline semanal |
| `/timeline/monthly` | Timeline mensal |
| `/timeline/yearly` | Timeline anual |
| `/reports` | Relatório e CSV |
| `/chat` | Chat direto |

## Kanban e Tasks

Na rota `/kanban`, abra **Nova tarefa** quando sua capability permitir. Informe título e prioridade. A Task começa em **A Fazer**. Para editar, use a ação do card; Tasks concluídas são imutáveis. Para abrir o detalhe, use a ação de detalhes.

As colunas são fixas: **A Fazer**, **Em Andamento**, **Pausado** e **Concluído**. Use as ações do card ou arraste para uma transição válida. O histórico aparece no detalhe. Transições inválidas, falta de permissão, Task de outro usuário ou Task concluída retornam erro.

O detalhe permite ver dados, histórico, Attachments e horas. Ações de criação/edição/transição dependem das permissões resolvidas pelo backend e da empresa ativa. Em telas pequenas, o conteúdo do detalhe rola internamente.

## Attachments

Attachments são acessados no detalhe de uma Task. A listagem mostra apenas metadados. Para FILE, use **Upload**, selecione o arquivo e aguarde a confirmação; para LINK, informe título e URL HTTP/HTTPS. O download de FILE é iniciado por ação explícita. A remoção exige confirmação. O limite de FILE é 10 MB; tipos e conteúdo são validados pelo servidor.

Attachments de Requisition também existem na API, mas não há tela frontend dedicada para criação/edição de Requisition neste estado. Não confunda um LINK com um arquivo hospedado pelo Orbis.

## Empresas, usuários e memberships

É possível selecionar uma empresa acessível no início ou pelo cabeçalho. A interface não permite criar ou editar empresas, ativar/inativar empresas, alterar timezone, criar usuários, listar usuários administrativamente, criar memberships, alterar cargo ou alterar permissões.

`POST /users`, `POST /companies` e `POST /memberships` são operações de API, não ações disponíveis no menu. Não existe fluxo oficial de criação ou promoção de usuário MASTER.

## Requisitions

Requisitions aparecem como leitura indireta nas timelines mensal e anual. Essas telas permitem navegar, filtrar e consultar indicadores dos dados recebidos, mas não criam, editam, excluem ou detalham uma Requisition em uma página própria.

CRUD, assignees, associação administrativa com System/Version e anexos de Requisition são operações de API. Não estão disponíveis na interface.

## Systems, Versions e Releases

Não existem telas frontend para cadastrar, listar, editar ou excluir Systems e Versions.

Não existe tela frontend para criar, listar, editar, publicar ou excluir Releases. A API aceita `artifactLocation` como localização textual opaca. Não há download de Release e o Orbis não armazena artefatos. Essa limitação é independente dos Attachments, que permanecem em PostgreSQL BYTEA.

## Horas e pausas

O detalhe mostra horas registradas. Usuários autorizados podem registrar uma duração manual entre 1 e 1440 minutos, com descrição opcional de até 1000 caracteres. O registro não altera status, pausa, estimativa ou capacidade. Tasks concluídas continuam elegíveis conforme a autorização.

Pausar, retomar e concluir são transições do Kanban. Uma pausa aberta é fechada ao retomar ou concluir; o histórico não é sobrescrito. Horas trabalhadas e estimativa são valores diferentes.

## Capacidade

Na página da empresa, quando `capacity.read` estiver disponível, use **Simulação de capacidade**. Informe data inicial e horas estimadas. O resultado usa desenvolvedores elegíveis, horas diárias configuradas, dias úteis e feriados informados no contrato. A simulação é somente leitura e aparece como **Não persistida**. Sem configuração ou sem capacidade, o servidor informa a limitação. Não há tela para alterar a configuração persistida de capacidade e não há planejamento automático de Tasks.

## Timelines

`/timeline` mostra Tasks da semana selecionada, com filtros de responsável, status e prioridade. A semana começa na segunda-feira; tarefas sem datas, atrasadas e somente de fim de semana aparecem em grupos próprios.

`/timeline/monthly` mostra Requisitions que intersectam o mês, com número, título, prioridade, horas estimadas, datas, entrega, atraso e indicadores. `/timeline/yearly` mostra janeiro a dezembro, agrupamento por prioridade e expansão mensal. As três telas são somente leitura e dependem da empresa ativa e das permissões de leitura correspondentes.

## Reports

Em `/reports`, filtre Tasks por período, Requisition, funcionário, status e prioridade. O resultado diferencia `estimatedHours` de `workedHours`. **Exportar CSV** baixa todos os resultados filtrados, limitado a 10.000 Tasks. É uma leitura; não altera Tasks ou Attachments.

## Notifications

Abra a central pelo cabeçalho. Ela lista notificações próprias, mostra não lidas e permite marcar uma como lida. Em preferências, ative ou desative o canal in-app por evento. Os eventos atuais são atribuição de Task, mudança de status, atribuição/conclusão de Requisition e publicação de Release. Não há e-mail, push, WebSocket, polling ou atualização automática.

## Chat direto

Em `/chat`, selecione um membro ativo e crie uma conversa. Envie texto de 1 a 5000 caracteres; Enter envia e Shift+Enter quebra linha. O histórico usa paginação por cursor e o marcador de leitura é por conversa. Só existem conversas diretas entre duas pessoas da mesma empresa. Não há edição, remoção, anexos, menções, tempo real ou polling.

## Releases

Não há tela frontend de catálogo de Releases neste estado. Na API, uma Release é metadado ligado a uma Version. A publicação exige `artifactLocation`, um texto de até 2048 caracteres. O Orbis não armazena nem baixa o artefato, não valida URL/caminho e não oferece download binário.

## Audit

Auditoria é uma consulta administrativa/técnica em `/companies/:companyId/audit`, disponível a usuários com `audit.read`. Ela lista ações sensíveis com ator, entidade, data e metadados mínimos. Senhas, tokens, cookies, binários e conteúdo integral não são exibidos. A interface frontend de Audit não está implementada; o acesso é pela API/Scalar.

## Funções fora da interface

Quando este manual mencionar API/Scalar, trata-se de uma operação não disponível no menu ou nas páginas frontend. Endpoints, clients, fixtures e testes não representam telas. A ausência de UI não significa ausência do contrato backend.

## Erros comuns e mobile

`401` indica sessão ausente/expirada; `403` falta de permissão; `404` recurso inexistente ou fora da empresa; `409` conflito; `422` regra de negócio ou limite; erro de rede indica API indisponível. Refaça a ação após corrigir a causa, sem duplicar submits.

No celular, use a rolagem interna dos diálogos e deslize horizontalmente no Kanban. Campos e ações mantêm foco e labels acessíveis. Recursos marcados como somente leitura não exibem ações de alteração, mas o backend continua sendo a autoridade.
