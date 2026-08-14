import { createHash, randomBytes, scrypt as scryptCallback } from "node:crypto";
import postgres from "postgres";
import { fixture, fixtureFile, secondFixtureFile } from "./fixture-types";

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
  const thirdHash = await passwordHash("AuditThird-2026!");
  const checksum = createHash("sha256").update(fixtureFile).digest("hex");
  const secondChecksum = createHash("sha256").update(secondFixtureFile).digest("hex");
  const now = new Date("2026-01-02T12:00:00.000Z");
  const longTaskDescription = "Conteúdo longo para auditoria browser ".repeat(12);
  const longTimeEntryDescription = "Descrição longa ".repeat(20);

  await sql.begin(async (tx) => {
    await tx`insert into companies (id, name, timezone, daily_hours_per_developer, is_active, created_at, updated_at)
      values (${fixture.companyA}, 'Audit Company A', 'America/Sao_Paulo', 8, true, ${now}, ${now}),
             (${fixture.companyB}, 'Audit Company B', 'America/Sao_Paulo', null, true, ${now}, ${now})`;
    await tx`insert into users (id, email, name, password_hash, is_active, created_at, updated_at)
      values (${fixture.actorId}, ${fixture.actorEmail}, ${fixture.actorName}, ${actorHash}, true, ${now}, ${now}),
             (${fixture.thirdId}, ${fixture.thirdEmail}, 'Audit Third', ${thirdHash}, true, ${now}, ${now}),
             (${fixture.developerAId}, 'audit-developer@orbis.test', 'Audit Developer', ${actorHash}, true, ${now}, ${now})`;
    await tx`insert into memberships (id, company_id, user_id, position, permissions, is_active, created_at, updated_at)
      values ('00000000-0000-4000-8000-000000000021', ${fixture.companyA}, ${fixture.actorId}, 'GESTOR', ${JSON.stringify(["tasks.create", "tasks.update", "tasks.read", "kanban.manage", "hours.register", "capacity.read", "company.read", "users.read", "requisitions.read"])}, true, ${now}, ${now}),
             ('00000000-0000-4000-8000-000000000022', ${fixture.companyA}, ${fixture.thirdId}, 'DESENVOLVEDOR', ${JSON.stringify(["tasks.read"])}, true, ${now}, ${now}),
             ('00000000-0000-4000-8000-000000000023', ${fixture.companyA}, ${fixture.developerAId}, 'DESENVOLVEDOR', ${JSON.stringify(["tasks.read"])}, true, ${now}, ${now}),
              ('00000000-0000-4000-8000-000000000024', ${fixture.companyB}, ${fixture.actorId}, 'GESTOR', ${JSON.stringify(["tasks.read", "requisitions.read", "company.read"])}, true, ${now}, ${now})`;
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
  });
  await sql.end();
}
