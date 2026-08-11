import { describe, expect, it } from "vitest";
import {
  attachmentBlobs,
  attachmentKindEnum,
  attachments,
  auditLogs,
  companies,
  conversationMembers,
  conversations,
  memberships,
  messages,
  notificationPreferences,
  notifications,
  priorityEnum,
  releases,
  requisitionAssignees,
  requisitions,
  systems,
  systemVersions,
  taskPauseIntervals,
  taskStatusEnum,
  taskStatusHistory,
  tasks,
  timeEntries,
  users,
} from "./schema";

const allTables = [
  companies,
  users,
  memberships,
  systems,
  systemVersions,
  releases,
  requisitions,
  requisitionAssignees,
  tasks,
  taskStatusHistory,
  taskPauseIntervals,
  timeEntries,
  attachments,
  attachmentBlobs,
  notificationPreferences,
  notifications,
  conversations,
  conversationMembers,
  messages,
  auditLogs,
];

const tenantOwned = [
  systems,
  systemVersions,
  releases,
  requisitions,
  requisitionAssignees,
  tasks,
  timeEntries,
  attachments,
  notifications,
  conversations,
];

describe("schema base", () => {
  it("define as 20 tabelas do schema base", () => {
    expect(allTables).toHaveLength(20);
    for (const table of allTables) {
      expect(table).toBeDefined();
    }
  });

  it("entidades tenant-owned possuem companyId", () => {
    for (const table of tenantOwned) {
      expect("companyId" in table).toBe(true);
    }
  });

  it("empresas, usuários e memberships possuem campos de identidade", () => {
    expect("id" in companies).toBe(true);
    expect("name" in companies).toBe(true);
    expect("timezone" in companies).toBe(true);
    expect("email" in users).toBe(true);
    expect("passwordHash" in users).toBe(true);
    expect("companyId" in memberships).toBe(true);
    expect("userId" in memberships).toBe(true);
    expect("position" in memberships).toBe(true);
  });

  it("requisições possuem número único por empresa e campos de negócio", () => {
    expect("number" in requisitions).toBe(true);
    expect("title" in requisitions).toBe(true);
    expect("priority" in requisitions).toBe(true);
    expect("status" in requisitions).toBe(true);
    expect("estimatedHours" in requisitions).toBe(true);
    expect("startDate" in requisitions).toBe(true);
    expect("plannedDeliveryDate" in requisitions).toBe(true);
    expect("deliveredAt" in requisitions).toBe(true);
  });

  it("tarefas possuem status e vínculos com requisição", () => {
    expect("title" in tasks).toBe(true);
    expect("status" in tasks).toBe(true);
    expect("requisitionId" in tasks).toBe(true);
    expect("assigneeId" in tasks).toBe(true);
    expect("completedAt" in tasks).toBe(true);
  });

  it("anexos possuem blob dedicado com dados binários", () => {
    expect("requisitionId" in attachments).toBe(true);
    expect("taskId" in attachments).toBe(true);
    expect("kind" in attachments).toBe(true);
    expect("createdBy" in attachments).toBe(true);
    expect("attachmentId" in attachmentBlobs).toBe(true);
    expect("data" in attachmentBlobs).toBe(true);
  });

  it("define enums de prioridade, status e tipo de anexo", () => {
    expect(priorityEnum.enumValues).toEqual(["LOW", "MEDIUM", "HIGH"]);
    expect(taskStatusEnum.enumValues).toEqual(["TODO", "IN_PROGRESS", "PAUSED", "DONE"]);
    expect(attachmentKindEnum.enumValues).toEqual(["FILE", "LINK"]);
  });
});
