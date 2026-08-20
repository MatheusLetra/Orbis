import { useState } from "react";
import { Navigate, useOutletContext } from "react-router-dom";
import { IdLookupField } from "@/components/common/id-lookup-field";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { QuickTaskDialog } from "@/features/kanban/quick-task-dialog";
import { createMemberLookup } from "@/features/lookups/lookup-adapters";
import { adminClient } from "./admin-client";
import {
  ADMIN_PERMISSIONS,
  type AdminCompany,
  type AdminMember,
  DEFAULT_PERMISSIONS_BY_POSITION,
  PERMISSION_LABELS,
  type Permission,
  type Release,
  type Requisition,
  type SoftwareSystem,
  type SystemVersion,
} from "./admin-contracts";
import type { AdminOutletContext } from "./admin-layout";
import {
  useAdminAction,
  useAdminAudit,
  useAdminCompanies,
  useAdminMembers,
  useAdminReleases,
  useAdminRequisition,
  useAdminRequisitions,
  useAdminSystems,
  useAdminVersions,
  useCapacitySettings,
} from "./admin-queries";
import {
  adminActionError,
  Card,
  Cards,
  Field,
  FormDialog,
  PageHeader,
  SelectField,
  State,
} from "./admin-ui";

const value = (data: FormData, key: string) => String(data.get(key) ?? "").trim();
const nullable = (data: FormData, key: string) => value(data, key) || null;
const dateOrNull = (data: FormData, key: string) => {
  const input = value(data, key);
  return input || null;
};
const dateInput = (date: string | null | undefined) => (date ? date.slice(0, 10) : "");
const displayDate = (date: string | null) =>
  date
    ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(
        new Date(date),
      )
    : "-";
function useAdmin() {
  return useOutletContext<AdminOutletContext>();
}
function Gate({ capability, children }: { capability: Permission; children: React.ReactNode }) {
  const { capabilities } = useAdmin();
  return capabilities[capability] ? (
    children
  ) : (
    <p role="alert">Você não possui permissão para acessar esta área.</p>
  );
}

export function AdminHomePage() {
  const { capabilities } = useAdmin();
  const target = [
    { path: "/admin/companies", permission: "company.read" },
    { path: "/admin/users", permission: "users.read" },
    { path: "/admin/requisitions", permission: "requisitions.read" },
    { path: "/admin/systems", permission: "systems.read" },
    { path: "/admin/releases", permission: "releases.read" },
    { path: "/admin/audit", permission: "audit.read" },
  ].find((item) => capabilities[item.permission as Permission]);
  return target ? <Navigate to={target.path} replace /> : null;
}

export function CompaniesPage() {
  const { companyId, capabilities } = useAdmin();
  const query = useAdminCompanies(companyId);
  const capacity = useCapacitySettings(capabilities["capacity.read"] ? companyId : null);
  const action = useAdminAction(companyId);
  const [editing, setEditing] = useState<AdminCompany | "capacity" | null>(null);
  const close = () => {
    if (!action.isPending) setEditing(null);
  };
  const save = (data: FormData) => {
    if (editing === "capacity")
      action.mutate(
        () => adminClient.updateCapacity(companyId, Number(value(data, "dailyHoursPerDeveloper"))),
        { onSuccess: close },
      );
    else if (editing)
      action.mutate(
        () =>
          adminClient.updateCompany(editing.id, {
            name: value(data, "name"),
            timezone: value(data, "timezone"),
            settings: JSON.parse(value(data, "settings") || "{}"),
          }),
        { onSuccess: close },
      );
  };
  return (
    <Gate capability="company.read">
      <PageHeader
        title="Empresas"
        description="Dados do tenant e parâmetros de capacidade."
        action={
          <div className="flex gap-2">
            {capabilities["company.update"] && (
              <Button variant="outline" onClick={() => setEditing("capacity")}>
                Capacidade
              </Button>
            )}
          </div>
        }
      />
      <State
        pending={query.isPending}
        error={query.isError}
        empty={!query.data?.length}
        retry={query.refetch}
      >
        <Cards>
          {query.data?.map((company) => (
            <Card
              key={company.id}
              title={company.name}
              meta={`${company.timezone} · ${company.isActive ? "Ativa" : "Inativa"}`}
            >
              {capabilities["company.update"] && (
                <Button size="sm" variant="outline" onClick={() => setEditing(company)}>
                  Editar
                </Button>
              )}
            </Card>
          ))}
        </Cards>
      </State>
      <FormDialog
        open={editing !== null}
        title={editing === "capacity" ? "Configuração de capacidade" : "Editar empresa"}
        pending={action.isPending}
        error={adminActionError(action)}
        onClose={close}
        onSubmit={save}
      >
        {editing === "capacity" ? (
          <Field
            label="Horas diárias por desenvolvedor"
            name="dailyHoursPerDeveloper"
            type="number"
            defaultValue={capacity.data?.dailyHoursPerDeveloper ?? 8}
            required
          />
        ) : (
          <>
            <Field
              label="Nome"
              name="name"
              defaultValue={editing && typeof editing === "object" ? editing.name : ""}
              required
            />
            <Field
              label="Fuso horário"
              name="timezone"
              defaultValue={
                editing && typeof editing === "object" ? editing.timezone : "America/Sao_Paulo"
              }
              required
            />
            <Field
              label="Configurações (JSON)"
              name="settings"
              defaultValue={
                editing && typeof editing === "object" ? JSON.stringify(editing.settings) : "{}"
              }
              required
            />
          </>
        )}
      </FormDialog>
    </Gate>
  );
}

export function UsersPage() {
  const { companyId, capabilities } = useAdmin();
  const query = useAdminMembers(companyId);
  const action = useAdminAction(companyId);
  const [dialog, setDialog] = useState<"new" | AdminMember | null>(null);
  const close = () => {
    if (!action.isPending) setDialog(null);
  };
  const save = (data: FormData) => {
    if (dialog === "new")
      action.mutate(
        () =>
          adminClient.createMember(companyId, {
            email: value(data, "email"),
            name: value(data, "name"),
            password: value(data, "password"),
            position: value(data, "position"),
          }),
        { onSuccess: close },
      );
    else if (dialog)
      action.mutate(
        () =>
          adminClient.permissions(
            companyId,
            dialog.membershipId,
            ADMIN_PERMISSIONS.filter((permission) => data.get(permission) === "on"),
          ),
        { onSuccess: close },
      );
  };
  return (
    <Gate capability="users.read">
      <PageHeader
        title="Usuários"
        description="Membros, cargos e permissões explícitas da empresa."
        action={
          capabilities["users.manage"] && (
            <Button onClick={() => setDialog("new")}>Novo membro</Button>
          )
        }
      />
      <State
        pending={query.isPending}
        error={query.isError}
        empty={!query.data?.length}
        retry={query.refetch}
      >
        <Cards>
          {query.data?.map((member) => (
            <Card
              key={member.membershipId}
              title={member.name}
              meta={`${member.email} · ${member.position}`}
            >
              {capabilities["permissions.manage"] && (
                <Button size="sm" variant="outline" onClick={() => setDialog(member)}>
                  Permissões
                </Button>
              )}
            </Card>
          ))}
        </Cards>
      </State>
      <FormDialog
        open={dialog !== null}
        title={dialog === "new" ? "Criar membro" : `Permissões de ${dialog?.name ?? "membro"}`}
        pending={action.isPending}
        error={adminActionError(action)}
        onClose={close}
        onSubmit={save}
      >
        {dialog === "new" ? (
          <>
            <Field label="Nome" name="name" required />
            <Field label="E-mail" name="email" type="email" required />
            <Field label="Senha inicial" name="password" type="password" required />
            <SelectField label="Cargo" name="position" defaultValue="DESENVOLVEDOR" required>
              {["ADMINISTRADOR", "GESTOR", "SUPORTE", "TESTADOR", "DESENVOLVEDOR"].map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </SelectField>
          </>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {ADMIN_PERMISSIONS.map((permission) => (
              <label
                key={permission}
                className="flex items-center gap-2 rounded-md border p-3 text-sm"
              >
                <input
                  type="checkbox"
                  name={permission}
                  aria-label={permission}
                  defaultChecked={Boolean(
                    dialog &&
                      (dialog.permissions.length > 0
                        ? dialog.permissions.includes(permission)
                        : DEFAULT_PERMISSIONS_BY_POSITION[dialog.position]?.includes(permission)),
                  )}
                />
                <span>
                  <span className="font-medium">{PERMISSION_LABELS[permission]}</span>
                  <span className="block text-xs text-muted-foreground">{permission}</span>
                </span>
              </label>
            ))}
          </div>
        )}
      </FormDialog>
    </Gate>
  );
}

function RequisitionFields({
  item,
  systems,
  versions,
  onSystemChange,
}: {
  item?: Requisition;
  systems: SoftwareSystem[];
  versions: SystemVersion[];
  onSystemChange: (id: string) => void;
}) {
  return (
    <>
      <Field label="Título" name="title" defaultValue={item?.title} required />
      <div className="space-y-1.5">
        <Label htmlFor="admin-description">Descrição</Label>
        <textarea
          id="admin-description"
          name="description"
          defaultValue={item?.description ?? ""}
          className="min-h-24 w-full rounded-md border bg-background p-3 text-sm"
        />
      </div>
      <SelectField label="Prioridade" name="priority" defaultValue={item?.priority ?? "MEDIUM"}>
        <option value="LOW">Baixa</option>
        <option value="MEDIUM">Média</option>
        <option value="HIGH">Alta</option>
      </SelectField>
      <SelectField
        label="Sistema"
        name="systemId"
        defaultValue={item?.systemId ?? ""}
        onChange={onSystemChange}
      >
        <option value="">Sem sistema</option>
        {systems.map((system) => (
          <option key={system.id} value={system.id}>
            {system.name}
          </option>
        ))}
      </SelectField>
      <SelectField label="Versão" name="systemVersionId" defaultValue={item?.systemVersionId ?? ""}>
        <option value="">Sem versão</option>
        {versions.map((version) => (
          <option key={version.id} value={version.id}>
            {version.version}
          </option>
        ))}
      </SelectField>
      <Field
        label="Horas estimadas"
        name="estimatedHours"
        type="number"
        defaultValue={item?.estimatedHours ?? ""}
      />
      <Field
        label="Início"
        name="startDate"
        type="date"
        defaultValue={dateInput(item?.startDate)}
      />
      <Field
        label="Entrega planejada"
        name="plannedDeliveryDate"
        type="date"
        defaultValue={dateInput(item?.plannedDeliveryDate)}
      />
    </>
  );
}

export function RequisitionsPage() {
  const { companyId, capabilities } = useAdmin();
  const [search, setSearch] = useState("");
  const filters = search ? new URLSearchParams({ search }).toString() : "";
  const query = useAdminRequisitions(companyId, filters);
  const systems = useAdminSystems(companyId);
  const [systemId, setSystemId] = useState<string | null>(null);
  const versions = useAdminVersions(companyId, systemId);
  const action = useAdminAction(companyId);
  const [dialog, setDialog] = useState<"new" | Requisition | null>(null);
  const close = () => {
    if (!action.isPending) setDialog(null);
  };
  const save = (data: FormData) => {
    const body = {
      title: value(data, "title"),
      description: nullable(data, "description"),
      priority: value(data, "priority"),
      systemId: nullable(data, "systemId"),
      systemVersionId: nullable(data, "systemVersionId"),
      estimatedHours: value(data, "estimatedHours") ? Number(value(data, "estimatedHours")) : null,
      startDate: dateOrNull(data, "startDate"),
      plannedDeliveryDate: dateOrNull(data, "plannedDeliveryDate"),
    };
    const requestBody =
      dialog === "new"
        ? Object.fromEntries(Object.entries(body).filter(([, field]) => field !== null))
        : body;
    action.mutate(
      () =>
        dialog === "new"
          ? adminClient.createRequisition(companyId, requestBody)
          : adminClient.updateRequisition(companyId, (dialog as Requisition).id, requestBody),
      { onSuccess: close },
    );
  };
  const remove = (item: Requisition) => {
    if (window.confirm(`Excluir a requisição #${item.number}?`))
      action.mutate(() => adminClient.deleteRequisition(companyId, item.id));
  };
  return (
    <Gate capability="requisitions.read">
      <PageHeader
        title="Requisições"
        description="Demandas, responsáveis e associação com sistema e versão."
        action={
          capabilities["requisitions.create"] && (
            <Button onClick={() => setDialog("new")}>Nova requisição</Button>
          )
        }
      />
      <div className="mb-4">
        <label className="sr-only" htmlFor="requisition-search">
          Buscar requisições
        </label>
        <input
          id="requisition-search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por título"
          className="h-9 w-full rounded-md border bg-background px-3 text-sm sm:max-w-xs"
        />
      </div>
      <State
        pending={query.isPending}
        error={query.isError}
        empty={!query.data?.length}
        retry={query.refetch}
      >
        <Cards>
          {query.data?.map((item) => (
            <Card
              key={item.id}
              title={`#${item.number} ${item.title}`}
              meta={`${item.priority} · ${item.status}`}
            >
              <RequisitionDetailButton item={item} />
              {capabilities["requisitions.update"] && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSystemId(item.systemId);
                    setDialog(item);
                  }}
                >
                  Editar
                </Button>
              )}
              {capabilities["requisitions.delete"] && (
                <Button size="sm" variant="destructive" onClick={() => remove(item)}>
                  Excluir
                </Button>
              )}
            </Card>
          ))}
        </Cards>
      </State>
      <FormDialog
        open={dialog !== null}
        title={dialog === "new" ? "Nova requisição" : "Editar requisição"}
        pending={action.isPending}
        error={adminActionError(action)}
        onClose={close}
        onSubmit={save}
      >
        <RequisitionFields
          item={dialog === "new" ? undefined : (dialog ?? undefined)}
          systems={systems.data ?? []}
          versions={versions.data ?? []}
          onSystemChange={(id) => setSystemId(id || null)}
        />
      </FormDialog>
    </Gate>
  );
}

function RequisitionDetailButton({ item }: { item: Requisition }) {
  const { companyId, capabilities } = useAdmin();
  const [open, setOpen] = useState(false);
  const detail = useAdminRequisition(companyId, open ? item.id : null);
  const members = useAdminMembers(companyId);
  const action = useAdminAction(companyId);
  const [assigneeId, setAssigneeId] = useState("");
  const add = (data: FormData) =>
    action.mutate(() => adminClient.addAssignee(companyId, item.id, value(data, "userId")), {
      onSuccess: () => setAssigneeId(""),
    });
  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        Detalhes
      </Button>
      <FormDialog
        open={open}
        title={`Requisição #${item.number}`}
        pending={action.isPending}
        error={adminActionError(action)}
        onClose={() => setOpen(false)}
        onSubmit={add}
        submit={capabilities["requisitions.update"] === true}
      >
        <p className="text-sm text-muted-foreground">
          {detail.data?.description || "Sem descrição"}
        </p>
        <p className="text-sm">Entrega: {displayDate(detail.data?.plannedDeliveryDate ?? null)}</p>
        <div>
          <h3 className="mb-2 text-sm font-medium">Responsáveis</h3>
          {detail.data?.assignees?.map((assignee) => (
            <div
              key={assignee.userId}
              className="flex items-center justify-between border-t py-2 text-sm"
            >
              <span>
                {members.data?.find((member) => member.userId === assignee.userId)?.name ??
                  assignee.userId}
              </span>
              {capabilities["requisitions.update"] && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (window.confirm("Remover este responsável?"))
                      action.mutate(() =>
                        adminClient.removeAssignee(companyId, item.id, assignee.userId),
                      );
                  }}
                >
                  Remover
                </Button>
              )}
            </div>
          ))}
        </div>
        {capabilities["requisitions.update"] && (
          <IdLookupField
            name="userId"
            label="Adicionar responsável"
            value={assigneeId}
            displayValue={null}
            lookup={createMemberLookup(companyId)}
            initialItems={members.data
              ?.filter((member) => member.isActive)
              .map((member) => ({ id: member.userId, label: member.name }))}
            required
            onChange={(selected) => setAssigneeId(selected?.id ?? "")}
          />
        )}
      </FormDialog>
      {capabilities["tasks.create"] && (
        <QuickTaskDialog
          companyId={companyId}
          canCreate
          triggerLabel="Adicionar tarefa"
          initialRequisitionId={item.id}
          members={members.data?.map((member) => ({ userId: member.userId, name: member.name }))}
          requisitions={[{ id: item.id, number: item.number, title: item.title }]}
          enableMemberLookup={capabilities["users.read"] === true}
          enableRequisitionLookup={capabilities["requisitions.read"] === true}
        />
      )}
    </>
  );
}

export function SystemsPage() {
  const { companyId, capabilities } = useAdmin();
  const query = useAdminSystems(companyId);
  const action = useAdminAction(companyId);
  const [dialog, setDialog] = useState<"new" | SoftwareSystem | null>(null);
  const save = (data: FormData) =>
    action.mutate(
      () =>
        dialog === "new"
          ? adminClient.createSystem(companyId, {
              name: value(data, "name"),
              description: value(data, "description"),
            })
          : adminClient.updateSystem(companyId, (dialog as SoftwareSystem).id, {
              name: value(data, "name"),
              description: nullable(data, "description"),
            }),
      { onSuccess: () => setDialog(null) },
    );
  const remove = (id: string) => {
    if (window.confirm("Excluir este sistema?"))
      action.mutate(() => adminClient.deleteSystem(companyId, id));
  };
  return (
    <Gate capability="systems.read">
      <PageHeader
        title="Systems"
        description="Cadastre e administre os Systems da empresa."
        action={
          capabilities["systems.manage"] && (
            <Button onClick={() => setDialog("new")}>Novo sistema</Button>
          )
        }
      />
      <State
        pending={query.isPending}
        error={query.isError}
        empty={!query.data?.length}
        retry={query.refetch}
      >
        <Cards>
          {query.data?.map((system) => (
            <div key={system.id}>
              <Card title={system.name} meta={system.description ?? "Sem descrição"}>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    window.location.assign(
                      `/admin/versions?systemId=${encodeURIComponent(system.id)}`,
                    )
                  }
                >
                  Versions
                </Button>
                {capabilities["systems.manage"] && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => setDialog(system)}>
                      Editar
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => remove(system.id)}>
                      Excluir
                    </Button>
                  </>
                )}
              </Card>
            </div>
          ))}
        </Cards>
      </State>
      <FormDialog
        open={dialog !== null}
        title={dialog === "new" ? "Novo sistema" : "Editar sistema"}
        pending={action.isPending}
        error={adminActionError(action)}
        onClose={() => setDialog(null)}
        onSubmit={save}
      >
        <Field
          label="Nome"
          name="name"
          defaultValue={dialog === "new" ? "" : dialog?.name}
          required
        />
        <Field
          label="Descrição"
          name="description"
          defaultValue={dialog === "new" ? "" : (dialog?.description ?? "")}
        />
      </FormDialog>
    </Gate>
  );
}

function VersionsPanel({
  system,
  versions,
  pending,
}: {
  system: SoftwareSystem;
  versions: SystemVersion[];
  pending: boolean;
}) {
  const { companyId, capabilities } = useAdmin();
  const action = useAdminAction(companyId);
  const [dialog, setDialog] = useState<"new" | SystemVersion | null>(null);
  const save = (data: FormData) =>
    action.mutate(
      () =>
        dialog === "new"
          ? adminClient.createVersion(companyId, system.id, value(data, "version"))
          : adminClient.updateVersion(
              companyId,
              (dialog as SystemVersion).id,
              value(data, "version"),
            ),
      { onSuccess: () => setDialog(null) },
    );
  return (
    <section className="ml-3 border-l p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Versões</h3>
        {capabilities["versions.manage"] && (
          <Button size="sm" onClick={() => setDialog("new")}>
            Adicionar
          </Button>
        )}
      </div>
      {pending ? (
        <p aria-busy="true" className="text-sm">
          Carregando...
        </p>
      ) : (
        versions.map((version) => (
          <div key={version.id} className="flex items-center justify-between border-t py-2 text-sm">
            <span>{version.version}</span>
            {capabilities["versions.manage"] && (
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => setDialog(version)}>
                  Editar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (window.confirm(`Excluir a versão ${version.version}?`))
                      action.mutate(() => adminClient.deleteVersion(companyId, version.id));
                  }}
                >
                  Excluir
                </Button>
              </div>
            )}
          </div>
        ))
      )}
      <FormDialog
        open={dialog !== null}
        title={dialog === "new" ? "Nova versão" : "Editar versão"}
        pending={action.isPending}
        error={adminActionError(action)}
        onClose={() => setDialog(null)}
        onSubmit={save}
      >
        <Field
          label="Versão"
          name="version"
          defaultValue={dialog === "new" ? "" : dialog?.version}
          required
        />
      </FormDialog>
    </section>
  );
}

export function VersionsPage() {
  const { companyId, capabilities } = useAdmin();
  const systems = useAdminSystems(companyId);
  const [systemId, setSystemId] = useState(() =>
    new URLSearchParams(window.location.search).get("systemId"),
  );
  const versions = useAdminVersions(companyId, systemId);
  const system = systems.data?.find((item) => item.id === systemId);
  return (
    <Gate capability="systems.read">
      <PageHeader title="Versions" description="Versões pertencentes a um System selecionado." />
      <SelectField
        label="System"
        name="systemId"
        value={systemId ?? ""}
        onChange={(id) => {
          setSystemId(id || null);
          window.history.replaceState(
            {},
            "",
            id ? `/admin/versions?systemId=${encodeURIComponent(id)}` : "/admin/versions",
          );
        }}
      >
        <option value="">Selecione um System</option>
        {systems.data?.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </SelectField>
      {system ? (
        <VersionsPanel
          system={system}
          versions={versions.data ?? []}
          pending={versions.isPending}
        />
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">
          Selecione um System para consultar suas Versions.
        </p>
      )}
      {!capabilities["versions.manage"] && (
        <p className="mt-3 text-sm text-muted-foreground">Acesso somente para consulta.</p>
      )}
    </Gate>
  );
}

export function ReleasesPage() {
  const { companyId, capabilities } = useAdmin();
  const query = useAdminReleases(companyId);
  const systems = useAdminSystems(companyId);
  const [systemId, setSystemId] = useState<string | null>(null);
  const versions = useAdminVersions(companyId, systemId ?? systems.data?.[0]?.id ?? null);
  const action = useAdminAction(companyId);
  const [dialog, setDialog] = useState<"new" | Release | { publish: Release } | null>(null);
  const close = () => {
    if (!action.isPending) setDialog(null);
  };
  const save = (data: FormData) => {
    if (dialog && typeof dialog === "object" && "publish" in dialog)
      action.mutate(
        () =>
          adminClient.publishRelease(companyId, dialog.publish.id, {
            artifactName: value(data, "artifactName"),
            artifactLocation: value(data, "artifactLocation"),
          }),
        { onSuccess: close },
      );
    else {
      const body = {
        versionLabel: value(data, "versionLabel"),
        channel: value(data, "channel"),
      };
      action.mutate(
        () =>
          dialog === "new"
            ? adminClient.createRelease(companyId, {
                ...body,
                systemVersionId: value(data, "systemVersionId"),
              })
            : adminClient.updateRelease(companyId, (dialog as Release).id, body),
        { onSuccess: close },
      );
    }
  };
  return (
    <Gate capability="releases.read">
      <PageHeader
        title="Releases"
        description="Metadados de publicação. A localização do artefato é somente texto."
        action={
          capabilities["releases.manage"] && (
            <Button onClick={() => setDialog("new")}>Nova release</Button>
          )
        }
      />
      <State
        pending={query.isPending}
        error={query.isError}
        empty={!query.data?.length}
        retry={query.refetch}
      >
        <Cards>
          {query.data?.map((release) => (
            <Card
              key={release.id}
              title={release.versionLabel}
              meta={`${release.channel} · ${release.status}${release.artifactLocation ? ` · ${release.artifactLocation}` : ""}`}
            >
              {capabilities["releases.manage"] && release.status === "DRAFT" && (
                <>
                  <Button size="sm" variant="outline" onClick={() => setDialog(release)}>
                    Editar
                  </Button>
                  <Button size="sm" onClick={() => setDialog({ publish: release })}>
                    Publicar
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      if (window.confirm(`Excluir a release ${release.versionLabel}?`))
                        action.mutate(() => adminClient.deleteRelease(companyId, release.id));
                    }}
                  >
                    Excluir
                  </Button>
                </>
              )}
            </Card>
          ))}
        </Cards>
      </State>
      <FormDialog
        open={dialog !== null}
        title={
          dialog && typeof dialog === "object" && "publish" in dialog
            ? "Publicar release"
            : dialog === "new"
              ? "Nova release"
              : "Editar release"
        }
        pending={action.isPending}
        error={adminActionError(action)}
        onClose={close}
        onSubmit={save}
      >
        {dialog && typeof dialog === "object" && "publish" in dialog ? (
          <>
            <Field label="Nome do artefato" name="artifactName" required />
            <Field label="Localização do artefato" name="artifactLocation" required />
          </>
        ) : (
          <>
            {dialog === "new" && (
              <>
                <SelectField
                  label="Sistema"
                  name="system"
                  defaultValue={systemId ?? ""}
                  onChange={(id) => setSystemId(id || null)}
                >
                  <option value="">Selecione</option>
                  {systems.data?.map((system) => (
                    <option key={system.id} value={system.id}>
                      {system.name}
                    </option>
                  ))}
                </SelectField>
                <SelectField label="Versão do sistema" name="systemVersionId" required>
                  <option value="">Selecione</option>
                  {versions.data?.map((version) => (
                    <option key={version.id} value={version.id}>
                      {version.version}
                    </option>
                  ))}
                </SelectField>
              </>
            )}
            <Field
              label="Rótulo da release"
              name="versionLabel"
              defaultValue={dialog && dialog !== "new" ? dialog.versionLabel : ""}
              required
            />
            <SelectField
              label="Canal"
              name="channel"
              defaultValue={dialog && dialog !== "new" ? dialog.channel : "STABLE"}
            >
              <option value="STABLE">Stable</option>
              <option value="BETA">Beta</option>
            </SelectField>
          </>
        )}
      </FormDialog>
    </Gate>
  );
}

export function AuditPage() {
  const { companyId } = useAdmin();
  const [filters, setFilters] = useState("");
  const query = useAdminAudit(companyId, filters);
  const apply = (data: FormData) => {
    const params = new URLSearchParams();
    for (const key of ["action", "entityType", "actorUserId", "from", "to"]) {
      const item = value(data, key);
      if (item)
        params.set(key, key === "from" || key === "to" ? new Date(item).toISOString() : item);
    }
    params.set("limit", "50");
    setFilters(params.toString());
  };
  return (
    <Gate capability="audit.read">
      <PageHeader title="Auditoria" description="Histórico imutável de ações no tenant." />
      <form
        className="mb-5 grid gap-3 rounded-lg border p-4 sm:grid-cols-2 lg:grid-cols-3"
        onSubmit={(event) => {
          event.preventDefault();
          apply(new FormData(event.currentTarget));
        }}
      >
        <Field label="Ação" name="action" />
        <Field label="Tipo de entidade" name="entityType" />
        <Field label="ID do ator" name="actorUserId" />
        <Field label="De" name="from" type="datetime-local" />
        <Field label="Até" name="to" type="datetime-local" />
        <div className="flex items-end">
          <Button type="submit">Filtrar</Button>
        </div>
      </form>
      <State
        pending={query.isPending}
        error={query.isError}
        empty={!query.data?.pages.some((page) => page.items.length)}
        retry={query.refetch}
      >
        <Cards>
          {query.data?.pages
            .flatMap((page) => page.items)
            .map((item) => (
              <Card
                key={item.id}
                title={item.action}
                meta={`${item.entityType ?? "-"} · ${item.entityId ?? "-"} · ${displayDate(item.createdAt)}`}
              />
            ))}
        </Cards>
      </State>
      {query.hasNextPage && (
        <Button
          className="mt-4"
          variant="outline"
          disabled={query.isFetchingNextPage}
          onClick={() => void query.fetchNextPage()}
        >
          Carregar mais
        </Button>
      )}
    </Gate>
  );
}
