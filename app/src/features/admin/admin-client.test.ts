import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "@/lib/http/api-client";
import { adminClient } from "./admin-client";

describe("adminClient", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("usa membershipId e rota tenant-aware ao substituir permissões", async () => {
    const request = vi.spyOn(apiClient, "request").mockResolvedValue({ id: "membership-a" });
    await adminClient.permissions("company/a", "membership/a", ["audit.read"]);
    expect(request).toHaveBeenCalledWith(
      "/companies/company%2Fa/memberships/membership%2Fa/permissions",
      { method: "PATCH", body: { permissions: ["audit.read"] } },
    );
  });

  it("publica somente metadados textuais do artefato", async () => {
    const release = {
      id: "release-a",
      companyId: "company-a",
      systemVersionId: "version-a",
      versionLabel: "1.0",
      channel: "STABLE",
      status: "PUBLISHED",
      artifactName: "build.zip",
      artifactLocation: "s3://external/build.zip",
      publishedAt: "2026-08-14T10:00:00.000Z",
      createdBy: "user-a",
      createdAt: "2026-08-14T09:00:00.000Z",
    };
    const request = vi.spyOn(apiClient, "request").mockResolvedValue(release);
    await adminClient.publishRelease("company-a", "release-a", {
      artifactName: "build.zip",
      artifactLocation: "s3://external/build.zip",
    });
    expect(request).toHaveBeenCalledWith("/companies/company-a/releases/release-a/publish", {
      method: "POST",
      body: { artifactName: "build.zip", artifactLocation: "s3://external/build.zip" },
    });
  });

  it("cobre os contratos CRUD tenant-aware", async () => {
    const request = vi.spyOn(apiClient, "request");
    const company = {
      id: "company-a",
      name: "Orbis",
      timezone: "UTC",
      settings: {},
      isActive: true,
      createdAt: "2026-08-14T10:00:00.000Z",
      updatedAt: "2026-08-14T10:00:00.000Z",
    };
    const member = {
      id: "membership-a",
      userId: "user-a",
      email: "a@b.com",
      name: "Ana",
      position: "GESTOR",
      permissions: [],
      userIsActive: true,
    };
    const system = {
      id: "system-a",
      companyId: "company-a",
      name: "Portal",
      description: null,
      isActive: true,
      createdAt: company.createdAt,
      updatedAt: company.updatedAt,
    };
    const version = {
      id: "version-a",
      companyId: "company-a",
      systemId: "system-a",
      version: "1",
      isActive: true,
      createdAt: company.createdAt,
      updatedAt: company.updatedAt,
    };
    const requisition = {
      id: "req-a",
      companyId: "company-a",
      number: 1,
      title: "Req",
      priority: "HIGH",
      status: "OPEN",
      requesterId: "user-a",
      createdAt: company.createdAt,
      updatedAt: company.updatedAt,
    };
    const release = {
      id: "release-a",
      companyId: "company-a",
      systemVersionId: "version-a",
      versionLabel: "1",
      channel: "STABLE",
      status: "DRAFT",
      createdBy: "user-a",
      createdAt: company.createdAt,
    };

    request.mockResolvedValue([company]);
    await adminClient.companies();
    request.mockResolvedValue(company);
    await adminClient.createCompany({ name: "Orbis" });
    await adminClient.updateCompany("company-a", { name: "Orbis 2" });
    request.mockResolvedValue({ companyId: "company-a", dailyHoursPerDeveloper: null });
    await adminClient.capacity("company-a");
    await adminClient.updateCapacity("company-a", 8);
    request.mockResolvedValue([member]);
    await adminClient.members("company-a");
    request.mockResolvedValue(member);
    await adminClient.createMember("company-a", {});
    request.mockResolvedValue([requisition]);
    await adminClient.requisitions("company-a", "status=OPEN");
    await adminClient.requisitions("company-a", "");
    request.mockResolvedValue(requisition);
    await adminClient.requisition("company-a", "req-a");
    await adminClient.createRequisition("company-a", {});
    await adminClient.updateRequisition("company-a", "req-a", {});
    request.mockResolvedValue([system]);
    await adminClient.systems("company-a");
    request.mockResolvedValue(system);
    await adminClient.createSystem("company-a", {});
    await adminClient.updateSystem("company-a", "system-a", {});
    request.mockResolvedValue([version]);
    await adminClient.versions("company-a", "system-a");
    request.mockResolvedValue(version);
    await adminClient.createVersion("company-a", "system-a", "1");
    await adminClient.updateVersion("company-a", "version-a", "2");
    request.mockResolvedValue([release]);
    await adminClient.releases("company-a");
    request.mockResolvedValue(release);
    await adminClient.createRelease("company-a", {});
    await adminClient.updateRelease("company-a", "release-a", {});
    request.mockResolvedValue({
      companyId: "company-a",
      items: [],
      hasMore: false,
      nextCursor: null,
    });
    await adminClient.audit("company-a", "limit=50");
    request.mockResolvedValue({});
    await adminClient.deleteRequisition("company-a", "req-a");
    await adminClient.addAssignee("company-a", "req-a", "user-a");
    await adminClient.removeAssignee("company-a", "req-a", "user-a");
    await adminClient.deleteSystem("company-a", "system-a");
    await adminClient.deleteVersion("company-a", "version-a");
    await adminClient.deleteRelease("company-a", "release-a");
    expect(request).toHaveBeenCalled();
  });
});
