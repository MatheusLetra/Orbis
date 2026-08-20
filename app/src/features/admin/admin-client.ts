import { apiClient, type RequestOptions } from "@/lib/http/api-client";
import {
  type Permission,
  parseAuditPage,
  parseCapacitySettings,
  parseCompanies,
  parseCompany,
  parseMember,
  parseMembers,
  parseRelease,
  parseReleases,
  parseRequisition,
  parseRequisitions,
  parseSystem,
  parseSystems,
  parseVersion,
  parseVersions,
} from "./admin-contracts";

type Signal = Pick<RequestOptions, "signal">;
const tenant = (id: string) => `/companies/${encodeURIComponent(id)}`;
const request = (path: string, options?: RequestOptions) =>
  apiClient.request<unknown>(path, options);
const mutate = (path: string, method: "POST" | "PATCH" | "DELETE", body?: unknown) =>
  request(path, { method, body });

export const adminClient = {
  companies: (options?: Signal) => request("/companies", options).then(parseCompanies),
  createCompany: (body: unknown) => mutate("/companies", "POST", body).then(parseCompany),
  updateCompany: (companyId: string, body: unknown) =>
    mutate(tenant(companyId), "PATCH", body).then(parseCompany),
  capacity: (companyId: string, options?: Signal) =>
    request(`${tenant(companyId)}/capacity-settings`, options).then(parseCapacitySettings),
  updateCapacity: (companyId: string, dailyHoursPerDeveloper: number) =>
    mutate(`${tenant(companyId)}/capacity-settings`, "PATCH", { dailyHoursPerDeveloper }).then(
      parseCapacitySettings,
    ),
  members: (companyId: string, options?: Signal) =>
    request(`${tenant(companyId)}/memberships`, options).then(parseMembers),
  createMember: (companyId: string, body: unknown) =>
    mutate(`${tenant(companyId)}/members`, "POST", body).then(parseMember),
  permissions: (companyId: string, membershipId: string, permissions: Permission[]) =>
    mutate(
      `${tenant(companyId)}/memberships/${encodeURIComponent(membershipId)}/permissions`,
      "PATCH",
      { permissions },
    ).then(parseMember),
  requisitions: (companyId: string, query: string, options?: Signal) =>
    request(`${tenant(companyId)}/requisitions${query ? `?${query}` : ""}`, options).then(
      parseRequisitions,
    ),
  requisition: (companyId: string, id: string, options?: Signal) =>
    request(`${tenant(companyId)}/requisitions/${encodeURIComponent(id)}`, options).then(
      parseRequisition,
    ),
  createRequisition: (companyId: string, body: unknown) =>
    mutate(`${tenant(companyId)}/requisitions`, "POST", body).then(parseRequisition),
  updateRequisition: (companyId: string, id: string, body: unknown) =>
    mutate(`${tenant(companyId)}/requisitions/${encodeURIComponent(id)}`, "PATCH", body).then(
      parseRequisition,
    ),
  deleteRequisition: (companyId: string, id: string) =>
    mutate(`${tenant(companyId)}/requisitions/${encodeURIComponent(id)}`, "DELETE"),
  addAssignee: (companyId: string, id: string, userId: string) =>
    mutate(`${tenant(companyId)}/requisitions/${encodeURIComponent(id)}/assignees`, "POST", {
      userId,
    }),
  removeAssignee: (companyId: string, id: string, userId: string) =>
    mutate(
      `${tenant(companyId)}/requisitions/${encodeURIComponent(id)}/assignees/${encodeURIComponent(userId)}`,
      "DELETE",
    ),
  systems: (companyId: string, options?: Signal) =>
    request(`${tenant(companyId)}/systems`, options).then(parseSystems),
  createSystem: (companyId: string, body: unknown) =>
    mutate(`${tenant(companyId)}/systems`, "POST", body).then(parseSystem),
  updateSystem: (companyId: string, id: string, body: unknown) =>
    mutate(`${tenant(companyId)}/systems/${encodeURIComponent(id)}`, "PATCH", body).then(
      parseSystem,
    ),
  deleteSystem: (companyId: string, id: string) =>
    mutate(`${tenant(companyId)}/systems/${encodeURIComponent(id)}`, "DELETE"),
  versions: (companyId: string, systemId: string, options?: Signal) =>
    request(`${tenant(companyId)}/systems/${encodeURIComponent(systemId)}/versions`, options).then(
      parseVersions,
    ),
  createVersion: (companyId: string, systemId: string, version: string) =>
    mutate(`${tenant(companyId)}/systems/${encodeURIComponent(systemId)}/versions`, "POST", {
      version,
    }).then(parseVersion),
  updateVersion: (companyId: string, id: string, version: string) =>
    mutate(`${tenant(companyId)}/versions/${encodeURIComponent(id)}`, "PATCH", { version }).then(
      parseVersion,
    ),
  deleteVersion: (companyId: string, id: string) =>
    mutate(`${tenant(companyId)}/versions/${encodeURIComponent(id)}`, "DELETE"),
  releases: (companyId: string, options?: Signal) =>
    request(`${tenant(companyId)}/releases`, options).then(parseReleases),
  createRelease: (companyId: string, body: unknown) =>
    mutate(`${tenant(companyId)}/releases`, "POST", body).then(parseRelease),
  updateRelease: (companyId: string, id: string, body: unknown) =>
    mutate(`${tenant(companyId)}/releases/${encodeURIComponent(id)}`, "PATCH", body).then(
      parseRelease,
    ),
  publishRelease: (companyId: string, id: string, body: unknown) =>
    mutate(`${tenant(companyId)}/releases/${encodeURIComponent(id)}/publish`, "POST", body).then(
      parseRelease,
    ),
  deleteRelease: (companyId: string, id: string) =>
    mutate(`${tenant(companyId)}/releases/${encodeURIComponent(id)}`, "DELETE"),
  audit: (companyId: string, query: string, options?: Signal) =>
    request(`${tenant(companyId)}/audit?${query}`, options).then(parseAuditPage),
};
