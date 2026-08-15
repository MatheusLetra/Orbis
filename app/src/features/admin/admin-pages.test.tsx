import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ADMIN_PERMISSIONS } from "./admin-contracts";
import {
  AuditPage,
  CompaniesPage,
  ReleasesPage,
  RequisitionsPage,
  SystemsPage,
  UsersPage,
  VersionsPage,
} from "./admin-pages";

const company = {
  id: "company-a",
  name: "Orbis",
  timezone: "America/Sao_Paulo",
  settings: {},
  isActive: true,
  createdAt: "2026-08-14T10:00:00.000Z",
  updatedAt: "2026-08-14T10:00:00.000Z",
};
const member = {
  membershipId: "membership-a",
  userId: "user-a",
  email: "ana@example.com",
  name: "Ana",
  position: "GESTOR",
  permissions: ["audit.read"],
  isActive: true,
};
const system = {
  id: "system-a",
  companyId: "company-a",
  name: "Portal",
  description: "Sistema principal",
  isActive: true,
  createdAt: company.createdAt,
  updatedAt: company.updatedAt,
};
const version = {
  id: "version-a",
  companyId: "company-a",
  systemId: "system-a",
  version: "1.0.0",
  isActive: true,
  createdAt: company.createdAt,
  updatedAt: company.updatedAt,
};
const requisition = {
  id: "req-a",
  companyId: "company-a",
  number: 7,
  title: "Nova demanda",
  description: "Detalhes",
  priority: "HIGH",
  status: "OPEN",
  requesterId: "user-a",
  responsibleId: null,
  systemId: "system-a",
  systemVersionId: "version-a",
  estimatedHours: 8,
  startDate: null,
  plannedDeliveryDate: null,
  deliveredAt: null,
  createdAt: company.createdAt,
  updatedAt: company.updatedAt,
  assignees: [{ userId: "user-a", createdAt: company.createdAt }],
};
const release = {
  id: "release-a",
  companyId: "company-a",
  systemVersionId: "version-a",
  versionLabel: "1.0.0",
  channel: "STABLE",
  status: "DRAFT",
  artifactName: null,
  artifactLocation: null,
  publishedAt: null,
  createdBy: "user-a",
  createdAt: company.createdAt,
};
const auditItem = {
  id: "audit-a",
  companyId: "company-a",
  actorUserId: "user-a",
  action: "COMPANY_UPDATED",
  entityType: "company",
  entityId: "company-a",
  metadata: {},
  createdAt: company.createdAt,
};

const action = {
  isPending: false,
  isError: false,
  mutate: vi.fn((operation: () => Promise<unknown>, options?: { onSuccess?: () => void }) => {
    void operation();
    options?.onSuccess?.();
  }),
};
const client = vi.hoisted(() =>
  Object.fromEntries(
    [
      "updateCapacity",
      "createCompany",
      "updateCompany",
      "createMember",
      "permissions",
      "createRequisition",
      "updateRequisition",
      "deleteRequisition",
      "addAssignee",
      "removeAssignee",
      "createSystem",
      "updateSystem",
      "deleteSystem",
      "createVersion",
      "updateVersion",
      "deleteVersion",
      "createRelease",
      "updateRelease",
      "publishRelease",
      "deleteRelease",
    ].map((name) => [name, vi.fn().mockResolvedValue({})]),
  ),
);

vi.mock("react-router-dom", async (original) => ({
  ...(await original<typeof import("react-router-dom")>()),
  useOutletContext: () => ({
    companyId: "company-a",
    capabilities: Object.fromEntries(ADMIN_PERMISSIONS.map((permission) => [permission, true])),
  }),
}));
vi.mock("./admin-client", () => ({ adminClient: client }));
vi.mock("./admin-queries", () => ({
  useAdminAction: () => action,
  useAdminCompanies: () => ({ data: [company], isPending: false, isError: false }),
  useCapacitySettings: () => ({ data: { companyId: "company-a", dailyHoursPerDeveloper: 8 } }),
  useAdminMembers: () => ({ data: [member], isPending: false, isError: false }),
  useAdminRequisitions: () => ({ data: [requisition], isPending: false, isError: false }),
  useAdminRequisition: () => ({ data: requisition }),
  useAdminSystems: () => ({ data: [system], isPending: false, isError: false }),
  useAdminVersions: () => ({ data: [version], isPending: false, isError: false }),
  useAdminReleases: () => ({ data: [release], isPending: false, isError: false }),
  useAdminAudit: () => ({
    data: { pages: [{ items: [auditItem] }] },
    isPending: false,
    isError: false,
    hasNextPage: true,
    isFetchingNextPage: false,
    fetchNextPage: vi.fn(),
  }),
}));

function click(name: string | RegExp) {
  fireEvent.click(screen.getByRole("button", { name }));
}
function closeDialog() {
  click("Cancelar");
}
function submitDialog() {
  fireEvent.submit(screen.getByRole("dialog").querySelector("form") as HTMLFormElement);
}

describe("admin pages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it("abre criação, edição e capacidade de empresas", () => {
    render(<CompaniesPage />);
    click("Nova empresa");
    expect(screen.getByRole("dialog")).toHaveTextContent("Nova empresa");
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Nova" } });
    submitDialog();
    click("Editar");
    expect(screen.getByLabelText("Nome")).toHaveValue("Orbis");
    submitDialog();
    click("Capacidade");
    expect(screen.getByLabelText("Horas diárias por desenvolvedor")).toHaveValue(8);
    submitDialog();
    expect(client.createCompany).toHaveBeenCalled();
    expect(client.updateCompany).toHaveBeenCalled();
    expect(client.updateCapacity).toHaveBeenCalled();
  });

  it("abre criação e permissões de membros", () => {
    render(<UsersPage />);
    click("Novo membro");
    expect(screen.getByLabelText("E-mail")).toBeInTheDocument();
    submitDialog();
    click("Permissões");
    expect(screen.getByLabelText("audit.read")).toBeChecked();
    submitDialog();
    expect(client.createMember).toHaveBeenCalled();
    expect(client.permissions).toHaveBeenCalled();
  });

  it("mostra detalhes, edição e exclusão de requisição", () => {
    render(<RequisitionsPage />);
    fireEvent.change(screen.getByPlaceholderText("Buscar por título"), {
      target: { value: "demanda" },
    });
    click("Detalhes");
    expect(screen.getByRole("dialog")).toHaveTextContent("Detalhes");
    click("Remover");
    fireEvent.change(screen.getByLabelText("Adicionar responsável"), {
      target: { value: "user-a" },
    });
    submitDialog();
    closeDialog();
    click("Editar");
    expect(screen.getByLabelText("Título")).toHaveValue("Nova demanda");
    submitDialog();
    click("Nova requisição");
    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Outra" } });
    submitDialog();
    click("Excluir");
    expect(client.deleteRequisition).toHaveBeenCalled();
    expect(client.addAssignee).toHaveBeenCalled();
    expect(client.removeAssignee).toHaveBeenCalled();
  });

  it("administra sistemas e versões nas duas rotas", () => {
    const { unmount } = render(<SystemsPage />);
    click("Novo sistema");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    submitDialog();
    click("Editar");
    submitDialog();
    click("Versões");
    expect(screen.getByText("1.0.0")).toBeInTheDocument();
    click("Adicionar");
    submitDialog();
    fireEvent.click(screen.getAllByRole("button", { name: "Editar" }).at(-1) as HTMLElement);
    submitDialog();
    click("Versões");
    click("Excluir");
    unmount();
    render(<VersionsPage />);
    expect(screen.getByText("Sistemas e versões")).toBeInTheDocument();
  });

  it("abre criação, edição e publicação textual de releases", () => {
    render(<ReleasesPage />);
    click("Nova release");
    expect(screen.getByLabelText("Versão do sistema")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Versão do sistema"), {
      target: { value: "version-a" },
    });
    submitDialog();
    click("Editar");
    expect(screen.queryByLabelText("Versão do sistema")).not.toBeInTheDocument();
    submitDialog();
    click("Publicar");
    expect(screen.getByLabelText("Localização do artefato")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Nome do artefato"), { target: { value: "build" } });
    fireEvent.change(screen.getByLabelText("Localização do artefato"), {
      target: { value: "s3://external/build" },
    });
    submitDialog();
    click("Excluir");
  });

  it("filtra e pagina auditoria", () => {
    render(<AuditPage />);
    expect(screen.getByText("COMPANY_UPDATED")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Ação"), { target: { value: "COMPANY_UPDATED" } });
    fireEvent.submit(
      screen.getByRole("button", { name: "Filtrar" }).closest("form") as HTMLFormElement,
    );
    click("Carregar mais");
  });
});
