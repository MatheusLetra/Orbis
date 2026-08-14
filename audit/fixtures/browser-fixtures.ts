import { createHash, randomBytes, scrypt as scryptCallback } from "node:crypto";
import postgres from "postgres";
import { chatMessageId, fixture, fixtureFile, secondFixtureFile } from "./fixture-types";

const scrypt = (password: string, salt: string) =>
  new Promise<Buffer>((resolve, reject) =>
    scryptCallback(password, salt, 64, (error, derived) => (error ? reject(error) : resolve(derived as Buffer))),
  );

async function passwordHash(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  return `scrypt:${salt}:${(await scrypt(password, salt)).toString("hex")}`;
}

export async function seedBrowserFixtures(databaseUrl: string): Promise<void> {
  const sql = postgres(databaseUrl, { max: 1, prepare: false });
  const actorHash = await passwordHash(fixture.actorPassword);
  const thirdHash = await passwordHash(fixture.thirdPassword);
  const chatOutsiderHash = await passwordHash(fixture.chatOutsiderPassword);
  const checksum = createHash("sha256").update(fixtureFile).digest("hex");
  const secondChecksum = createHash("sha256").update(secondFixtureFile).digest("hex");
  const now = new Date("2026-01-02T12:00:00.000Z");
  const longTaskDescription = "Conteúdo longo para auditoria browser ".repeat(12);
  const longTimeEntryDescription = "Descrição longa ".repeat(20);
  const longNotificationBody = "Conteúdo longo de notificação sem quebra artificial ".repeat(24);

  await sql.begin(async (tx) => {
    await tx`insert into companies (id, name, timezone, daily_hours_per_developer, is_active, created_at, updated_at)
      values (${fixture.companyA}, 'Audit Company A', 'America/Sao_Paulo', 8, true, ${now}, ${now}),
             (${fixture.companyB}, 'Audit Company B', 'America/Sao_Paulo', null, true, ${now}, ${now})`;
    await tx`insert into users (id, email, name, password_hash, is_active, created_at, updated_at)
      values (${fixture.actorId}, ${fixture.actorEmail}, ${fixture.actorName}, ${actorHash}, true, ${now}, ${now}),
             (${fixture.thirdId}, ${fixture.thirdEmail}, 'Audit Third', ${thirdHash}, true, ${now}, ${now}),
             (${fixture.developerAId}, 'audit-developer@orbis.test', 'Audit Developer', ${actorHash}, true, ${now}, ${now}),
             (${fixture.chatOutsiderId}, ${fixture.chatOutsiderEmail}, 'Audit Chat Outsider', ${chatOutsiderHash}, true, ${now}, ${now}),
             (${fixture.chatTenantBPeerId}, 'audit-chat-tenant-b@orbis.test', 'Audit Chat Tenant B', ${actorHash}, true, ${now}, ${now})`;
    await tx`insert into memberships (id, company_id, user_id, position, permissions, is_active, created_at, updated_at)
           values (${fixture.actorMembershipA}, ${fixture.companyA}, ${fixture.actorId}, 'GESTOR', ${JSON.stringify(["tasks.create", "tasks.update", "tasks.read", "kanban.manage", "hours.register", "capacity.read", "company.read", "users.read", "requisitions.read", "chat.use", "audit.read"])}, true, ${now}, ${now}),
             (${fixture.thirdMembershipA}, ${fixture.companyA}, ${fixture.thirdId}, 'DESENVOLVEDOR', ${JSON.stringify(["tasks.read", "chat.use"])}, true, ${now}, ${now}),
             (${fixture.developerMembershipA}, ${fixture.companyA}, ${fixture.developerAId}, 'DESENVOLVEDOR', ${JSON.stringify(["tasks.read", "chat.use"])}, true, ${now}, ${now}),
              (${fixture.actorMembershipB}, ${fixture.companyB}, ${fixture.actorId}, 'GESTOR', ${JSON.stringify(["tasks.read", "requisitions.read", "company.read", "chat.use", "audit.read"])}, true, ${now}, ${now}),
             (${fixture.chatOutsiderMembershipA}, ${fixture.companyA}, ${fixture.chatOutsiderId}, 'DESENVOLVEDOR', ${JSON.stringify(["chat.use"])}, true, ${now}, ${now}),
             (${fixture.chatTenantBPeerMembership}, ${fixture.companyB}, ${fixture.chatTenantBPeerId}, 'DESENVOLVEDOR', ${JSON.stringify(["chat.use"])}, true, ${now}, ${now})`;
    await tx`insert into tasks (id, company_id, title, description, priority, status, assignee_id, completed_at, created_at, updated_at)
      values (${fixture.taskOwn}, ${fixture.companyA}, 'Audit própria', ${longTaskDescription}, 'MEDIUM', 'TODO', ${fixture.actorId}, null, ${now}, ${now}),
             (${fixture.taskThird}, ${fixture.companyA}, 'Audit terceiro', 'Task atribuída a terceiro', 'HIGH', 'IN_PROGRESS', ${fixture.thirdId}, null, ${now}, ${now}),
             (${fixture.taskUnassigned}, ${fixture.companyA}, 'Audit sem assignee', 'Task sem responsável', 'LOW', 'TODO', null, null, ${now}, ${now}),
             (${fixture.taskDone}, ${fixture.companyA}, 'Audit concluída', 'Task encerrada', 'MEDIUM', 'DONE', ${fixture.actorId}, ${now}, ${now}, ${now}),
              (${fixture.taskOtherTenant}, ${fixture.companyB}, 'Tenant B exclusivo', 'Não deve aparecer no tenant A', 'MEDIUM', 'TODO', ${fixture.actorId}, null, ${now}, ${now})`;
     await tx`insert into requisitions (id, company_id, number, title, description, priority, status, requester_id, responsible_id, estimated_hours, start_date, planned_delivery_date, delivered_at, created_at, updated_at)
       values (${fixture.monthlyInside}, ${fixture.companyA}, 201, 'Mensal dentro de agosto', 'Requisição contida no período auditado', 'MEDIUM', 'OPEN', ${fixture.actorId}, ${fixture.actorId}, 8, '2026-08-05', '2026-08-12', null, ${now}, ${now}),
              (${fixture.monthlySpanning}, ${fixture.companyA}, 202, 'Mensal atravessa meses', 'Requisição que cruza julho e setembro', 'HIGH', 'IN_PROGRESS', ${fixture.actorId}, ${fixture.thirdId}, 24, '2026-07-28', '2026-09-03', null, ${now}, ${now}),
              (${fixture.monthlyUndated}, ${fixture.companyA}, 203, 'Mensal sem datas', 'Requisição sem planejamento de datas', 'LOW', 'PAUSED', ${fixture.actorId}, null, 4, null, null, null, ${now}, ${now}),
              (${fixture.monthlyOverdue}, ${fixture.companyA}, 204, 'Mensal atrasada', 'Requisição vencida sem entrega', 'HIGH', 'IN_PROGRESS', ${fixture.actorId}, ${fixture.actorId}, 16, '2026-08-01', '2026-08-07', null, ${now}, ${now}),
              (${fixture.monthlyOnTime}, ${fixture.companyA}, 205, 'Mensal entregue no prazo', 'Requisição entregue antes da previsão', 'MEDIUM', 'DONE', ${fixture.actorId}, ${fixture.developerAId}, 12, '2026-08-14', '2026-08-28', '2026-08-27T18:00:00.000Z', ${now}, ${now}),
              (${fixture.monthlyCrossTenant}, ${fixture.companyB}, 206, 'Mensal tenant B', 'Não deve aparecer no tenant A', 'HIGH', 'DONE', ${fixture.actorId}, ${fixture.actorId}, 20, '2026-08-04', '2026-08-15', '2026-08-14T18:00:00.000Z', ${now}, ${now})`;
    await tx`insert into tasks (id, company_id, title, description, priority, status, assignee_id, start_date, planned_end_date, completed_at, created_at, updated_at)
      values (${fixture.timelineInside}, ${fixture.companyA}, 'Timeline dentro da semana', 'Tarefa contida na semana auditada', 'MEDIUM', 'TODO', ${fixture.actorId}, '2026-08-12', '2026-08-12', null, ${now}, ${now}),
             (${fixture.timelineSpanning}, ${fixture.companyA}, 'Timeline atravessa início e fim', 'Tarefa que cruza os dois limites da semana', 'HIGH', 'IN_PROGRESS', ${fixture.actorId}, '2026-08-07', '2026-08-18', null, ${now}, ${now}),
             (${fixture.timelinePaused}, ${fixture.companyA}, 'Timeline pausada', 'Tarefa pausada na semana', 'HIGH', 'PAUSED', ${fixture.thirdId}, '2026-08-13', '2026-08-14', null, ${now}, ${now}),
             (${fixture.timelineDone}, ${fixture.companyA}, 'Timeline concluída', 'Tarefa concluída na semana', 'MEDIUM', 'DONE', ${fixture.actorId}, '2026-08-10', '2026-08-11', '2026-08-11T18:00:00.000Z', ${now}, ${now}),
             (${fixture.timelineOverdue}, ${fixture.companyA}, 'Timeline atrasada anterior', 'Tarefa anterior ainda não concluída', 'HIGH', 'IN_PROGRESS', ${fixture.actorId}, '2026-08-03', '2026-08-07', null, ${now}, ${now}),
             (${fixture.timelineUndated}, ${fixture.companyA}, 'Timeline sem data', 'Tarefa sem planejamento', 'LOW', 'TODO', null, null, null, null, ${now}, ${now}),
             (${fixture.timelineWeekend}, ${fixture.companyA}, 'Timeline somente fim de semana', 'Tarefa de sábado e domingo', 'LOW', 'TODO', ${fixture.actorId}, '2026-08-15', '2026-08-16', null, ${now}, ${now}),
             (${fixture.timelineOutside}, ${fixture.companyA}, 'Timeline fora da semana', 'Tarefa da semana seguinte', 'MEDIUM', 'TODO', ${fixture.actorId}, '2026-08-20', '2026-08-21', null, ${now}, ${now}),
             (${fixture.timelineCrossTenant}, ${fixture.companyB}, 'Timeline cross-tenant B', 'Não pode aparecer no tenant A', 'HIGH', 'TODO', ${fixture.actorId}, '2026-08-12', '2026-08-13', null, ${now}, ${now})`;
    await tx`insert into attachments (id, company_id, task_id, kind, file_name, mime_type, checksum, size_bytes, title, created_by, created_at)
      values (${fixture.fileAttachment}, ${fixture.companyA}, ${fixture.taskOwn}, 'FILE', 'audit-file.pdf', 'application/pdf', ${checksum}, ${fixtureFile.length}, 'Arquivo de auditoria', ${fixture.actorId}, ${now})`;
    await tx`insert into attachment_blobs (attachment_id, data) values (${fixture.fileAttachment}, ${fixtureFile})`;
    await tx`insert into attachments (id, company_id, task_id, kind, file_name, mime_type, checksum, size_bytes, title, created_by, created_at)
      values (${fixture.secondFileAttachment}, ${fixture.companyA}, ${fixture.taskOwn}, 'FILE', 'audit-file-2.pdf', 'application/pdf', ${secondChecksum}, ${secondFixtureFile.length}, 'Segundo arquivo de auditoria', ${fixture.actorId}, ${now})`;
    await tx`insert into attachment_blobs (attachment_id, data) values (${fixture.secondFileAttachment}, ${secondFixtureFile})`;
    await tx`insert into attachments (id, company_id, task_id, kind, url, title, created_by, created_at)
      values (${fixture.linkAttachment}, ${fixture.companyA}, ${fixture.taskOwn}, 'LINK', 'https://example.com/orbis-audit', 'Documentação externa', ${fixture.actorId}, ${now})`;
    await tx`insert into time_entries (id, company_id, task_id, user_id, duration_minutes, description, created_at)
      values (${fixture.timeEntryOne}, ${fixture.companyA}, ${fixture.taskOwn}, ${fixture.actorId}, 30, 'Primeiro apontamento', ${now}),
             (${fixture.timeEntryTwo}, ${fixture.companyA}, ${fixture.taskOwn}, ${fixture.actorId}, 45, ${longTimeEntryDescription}, ${new Date(now.getTime() + 1000)})`;
    await tx`insert into notifications (id, company_id, user_id, type, title, body, read_at, data, created_at)
      values (${fixture.notificationAUnread}, ${fixture.companyA}, ${fixture.actorId}, 'TASK_ASSIGNED', 'Audit unread A', 'Notificação não lida do tenant A', null, ${JSON.stringify({ taskId: fixture.taskOwn })}, ${new Date(now.getTime() + 3000)}),
             (${fixture.notificationALong}, ${fixture.companyA}, ${fixture.actorId}, 'TASK_STATUS_CHANGED', 'Audit conteúdo longo A', ${longNotificationBody}, null, ${JSON.stringify({ taskId: fixture.taskOwn, status: "IN_PROGRESS" })}, ${new Date(now.getTime() + 2000)}),
             (${fixture.notificationARead}, ${fixture.companyA}, ${fixture.actorId}, 'REQUISITION_COMPLETED', 'Audit read A', 'Notificação já lida do tenant A', ${new Date(now.getTime() + 1500)}, ${JSON.stringify({ requisitionId: fixture.monthlyOnTime })}, ${new Date(now.getTime() + 1000)}),
             (${fixture.notificationBUnread}, ${fixture.companyB}, ${fixture.actorId}, 'RELEASE_PUBLISHED', 'Audit exclusivo tenant B', 'Não deve aparecer no tenant A', null, ${JSON.stringify({ releaseId: "00000000-0000-4000-8000-000000000499" })}, ${new Date(now.getTime() + 4000)})`;
    await tx`insert into notification_preferences (id, user_id, company_id, event_type, in_app_enabled, created_at, updated_at)
      values (${fixture.preferenceATaskAssigned}, ${fixture.actorId}, ${fixture.companyA}, 'TASK_ASSIGNED', true, ${now}, ${now}),
             (${fixture.preferenceATaskStatusChanged}, ${fixture.actorId}, ${fixture.companyA}, 'TASK_STATUS_CHANGED', true, ${now}, ${now}),
             (${fixture.preferenceARequisitionAssigned}, ${fixture.actorId}, ${fixture.companyA}, 'REQUISITION_ASSIGNED', false, ${now}, ${now}),
             (${fixture.preferenceARequisitionCompleted}, ${fixture.actorId}, ${fixture.companyA}, 'REQUISITION_COMPLETED', true, ${now}, ${now}),
             (${fixture.preferenceAReleasePublished}, ${fixture.actorId}, ${fixture.companyA}, 'RELEASE_PUBLISHED', false, ${now}, ${now}),
             (${fixture.preferenceBTaskAssigned}, ${fixture.actorId}, ${fixture.companyB}, 'TASK_ASSIGNED', false, ${now}, ${now}),
             (${fixture.preferenceBTaskStatusChanged}, ${fixture.actorId}, ${fixture.companyB}, 'TASK_STATUS_CHANGED', true, ${now}, ${now}),
             (${fixture.preferenceBRequisitionAssigned}, ${fixture.actorId}, ${fixture.companyB}, 'REQUISITION_ASSIGNED', true, ${now}, ${now}),
              (${fixture.preferenceBRequisitionCompleted}, ${fixture.actorId}, ${fixture.companyB}, 'REQUISITION_COMPLETED', false, ${now}, ${now}),
               (${fixture.preferenceBReleasePublished}, ${fixture.actorId}, ${fixture.companyB}, 'RELEASE_PUBLISHED', true, ${now}, ${now})`;
    await tx`insert into audit_logs (id, company_id, actor_user_id, action, entity_type, entity_id, metadata, created_at)
      values (${fixture.auditCompanyUpdated}, ${fixture.companyA}, ${fixture.actorId}, 'COMPANY_UPDATED', 'COMPANY', ${fixture.companyA}, ${JSON.stringify({ changedFields: ['name'] })}, ${new Date(now.getTime() + 10)}),
             (${fixture.auditRequisitionCreated}, ${fixture.companyA}, ${fixture.actorId}, 'REQUISITION_CREATED', 'REQUISITION', ${fixture.monthlyInside}, ${JSON.stringify({ number: 201 })}, ${new Date(now.getTime() + 20)}),
             (${fixture.auditRequisitionUpdated}, ${fixture.companyA}, ${fixture.actorId}, 'REQUISITION_UPDATED', 'REQUISITION', ${fixture.monthlyInside}, ${JSON.stringify({ changedFields: ['title'] })}, ${new Date(now.getTime() + 30)}),
             (${fixture.auditRequisitionDeleted}, ${fixture.companyA}, ${fixture.actorId}, 'REQUISITION_DELETED', 'REQUISITION', ${fixture.monthlyUndated}, ${JSON.stringify({ number: 203 })}, ${new Date(now.getTime() + 40)}),
             (${fixture.auditTaskStatus}, ${fixture.companyA}, ${fixture.actorId}, 'TASK_STATUS_CHANGED', 'TASK', ${fixture.taskOwn}, ${JSON.stringify({ fromStatus: 'TODO', toStatus: 'IN_PROGRESS' })}, ${new Date(now.getTime() + 50)}),
             (${fixture.auditReleasePublished}, ${fixture.companyA}, ${fixture.actorId}, 'RELEASE_PUBLISHED', 'RELEASE', '00000000-0000-4000-8000-000000000609', ${JSON.stringify({ versionLabel: '1.0.0' })}, ${new Date(now.getTime() + 60)}),
             (${fixture.auditConfiguration}, ${fixture.companyA}, ${fixture.actorId}, 'CONFIGURATION_UPDATED', 'COMPANY_CAPACITY', ${fixture.companyA}, ${JSON.stringify({ changedFields: ['dailyHoursPerDeveloper'] })}, ${new Date(now.getTime() + 70)}),
             (${fixture.auditTenantB}, ${fixture.companyB}, ${fixture.actorId}, 'COMPANY_UPDATED', 'COMPANY', ${fixture.companyB}, ${JSON.stringify({ changedFields: ['timezone'] })}, ${new Date(now.getTime() + 80)})`;
    const directKeyA = [fixture.actorId, fixture.thirdId].sort().join(":");
    const directKeyB = [fixture.actorId, fixture.chatTenantBPeerId].sort().join(":");
    const chatAUpdatedAt = new Date("2026-01-02T13:00:56.000Z");
    const chatBUpdatedAt = new Date("2026-01-02T14:00:02.000Z");
    await tx`insert into conversations (id, company_id, type, direct_key, created_at, updated_at)
      values (${fixture.chatConversationA}, ${fixture.companyA}, 'direct', ${directKeyA}, ${now}, ${chatAUpdatedAt}),
             (${fixture.chatConversationB}, ${fixture.companyB}, 'direct', ${directKeyB}, ${now}, ${chatBUpdatedAt})`;
    await tx`insert into conversation_members (id, conversation_id, user_id, last_read_at, created_at)
      values (${fixture.chatConversationAMemberActor}, ${fixture.chatConversationA}, ${fixture.actorId}, ${new Date("2026-01-02T13:00:52.000Z")}, ${now}),
             (${fixture.chatConversationAMemberThird}, ${fixture.chatConversationA}, ${fixture.thirdId}, null, ${now}),
             (${fixture.chatConversationBMemberActor}, ${fixture.chatConversationB}, ${fixture.actorId}, null, ${now}),
             (${fixture.chatConversationBMemberPeer}, ${fixture.chatConversationB}, ${fixture.chatTenantBPeerId}, ${chatBUpdatedAt}, ${now})`;
    for (let sequence = 1; sequence <= 56; sequence += 1) {
      const senderId = sequence % 2 === 0 ? fixture.thirdId : fixture.actorId;
      const body = sequence === 55
        ? fixture.chatXssBody
        : sequence === 56
          ? fixture.chatLongBody
          : `Audit paginada ${String(sequence).padStart(2, "0")} - ${senderId === fixture.actorId ? "própria" : "alheia"}`;
      await tx`insert into messages (id, conversation_id, sender_id, body, created_at)
        values (${chatMessageId(sequence)}, ${fixture.chatConversationA}, ${senderId}, ${body}, ${new Date(`2026-01-02T13:00:${String(sequence).padStart(2, "0")}.000Z`)})`;
    }
    await tx`insert into messages (id, conversation_id, sender_id, body, created_at)
      values (${chatMessageId(57)}, ${fixture.chatConversationB}, ${fixture.actorId}, 'Mensagem exclusiva tenant B', ${new Date("2026-01-02T14:00:01.000Z")}),
             (${chatMessageId(58)}, ${fixture.chatConversationB}, ${fixture.chatTenantBPeerId}, 'Resposta exclusiva tenant B', ${chatBUpdatedAt})`;
  });
  await sql.end();
}
