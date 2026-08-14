export const fixture = {
  actorEmail: "audit-actor@orbis.test",
  actorPassword: "AuditPassword-2026!",
  actorName: "Audit Actor",
  thirdEmail: "audit-third@orbis.test",
  companyA: "00000000-0000-4000-8000-000000000001",
  companyB: "00000000-0000-4000-8000-000000000002",
  actorId: "00000000-0000-4000-8000-000000000011",
  thirdId: "00000000-0000-4000-8000-000000000012",
  developerAId: "00000000-0000-4000-8000-000000000013",
  taskOwn: "00000000-0000-4000-8000-000000000101",
  taskThird: "00000000-0000-4000-8000-000000000102",
  taskUnassigned: "00000000-0000-4000-8000-000000000103",
  taskDone: "00000000-0000-4000-8000-000000000104",
  taskOtherTenant: "00000000-0000-4000-8000-000000000105",
  fileAttachment: "00000000-0000-4000-8000-000000000201",
  linkAttachment: "00000000-0000-4000-8000-000000000202",
  secondFileAttachment: "00000000-0000-4000-8000-000000000203",
  timeEntryOne: "00000000-0000-4000-8000-000000000301",
  timeEntryTwo: "00000000-0000-4000-8000-000000000302",
} as const;

export const fixtureFile = Buffer.from("orbis-browser-audit-file-v1", "utf8");
export const secondFixtureFile = Buffer.from("orbis-browser-audit-file-v2", "utf8");
