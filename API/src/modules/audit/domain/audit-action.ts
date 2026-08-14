export const AUDIT_ACTIONS = [
  "AUTH_LOGIN_SUCCEEDED",
  "AUTH_LOGIN_FAILED",
  "AUTH_REFRESH_SUCCEEDED",
  "AUTH_REFRESH_FAILED",
  "AUTH_LOGOUT",
  "AUTHORIZATION_DENIED",
  "COMPANY_UPDATED",
  "REQUISITION_CREATED",
  "REQUISITION_UPDATED",
  "REQUISITION_DELETED",
  "TASK_STATUS_CHANGED",
  "RELEASE_PUBLISHED",
  "CONFIGURATION_UPDATED",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export function isAuditAction(value: string): value is AuditAction {
  return (AUDIT_ACTIONS as readonly string[]).includes(value);
}
