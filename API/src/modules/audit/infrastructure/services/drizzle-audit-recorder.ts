import type {
  AuditRecorder,
  AuditRecordInput,
} from "@/modules/audit/application/ports/audit-recorder";
import { AuditLog } from "@/modules/audit/domain/entities/audit-log";
import type { AuditLogRepository } from "@/modules/audit/domain/repositories/audit-log-repository";
import {
  type DatabaseExecutor,
  DrizzleAuditLogRepository,
} from "@/modules/audit/infrastructure/repositories/drizzle-audit-log-repository";

export class DrizzleAuditRecorder implements AuditRecorder {
  private readonly repository: AuditLogRepository;

  constructor(db: DatabaseExecutor) {
    this.repository = new DrizzleAuditLogRepository(db);
  }

  async record(input: AuditRecordInput): Promise<void> {
    await this.repository.create(AuditLog.create(input));
  }
}
