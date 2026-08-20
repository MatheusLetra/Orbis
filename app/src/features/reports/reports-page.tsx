import { Download, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/app/layouts/app-shell";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { IdLookupField } from "@/components/common/id-lookup-field";
import { LoadingState } from "@/components/common/loading-state";
import { Button } from "@/components/ui/button";
import { useActiveCompany } from "@/features/companies/active-company-provider";
import { useCompanyCapabilities } from "@/features/companies/capabilities-queries";
import { createMemberLookup, createRequisitionLookup } from "@/features/lookups/lookup-adapters";
import { reportClient } from "./report-client";
import {
  REPORT_PRIORITIES,
  REPORT_STATUSES,
  type TaskReportFilters,
  type TaskReportItem,
} from "./report-contracts";
import { useTaskReport } from "./report-queries";

const labels = {
  TODO: "A fazer",
  IN_PROGRESS: "Em andamento",
  PAUSED: "Pausada",
  DONE: "Concluída",
  LOW: "Baixa",
  MEDIUM: "Média",
  HIGH: "Alta",
} as const;
const field =
  "h-11 min-w-0 rounded-md border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function ReportsPage() {
  const company = useActiveCompany();
  const capabilities = useCompanyCapabilities(company.activeCompany?.id ?? null);
  const [filters, setFilters] = useState<TaskReportFilters>({});
  const [page, setPage] = useState(1);
  const [downloading, setDownloading] = useState(false);
  const [exportError, setExportError] = useState(false);
  const exportController = useRef<AbortController | null>(null);
  const report = useTaskReport(company.activeCompany?.id ?? null, filters, page);
  useEffect(() => () => exportController.current?.abort(), []);
  async function download() {
    if (!company.activeCompany || downloading) return;
    setDownloading(true);
    setExportError(false);
    const controller = new AbortController();
    exportController.current = controller;
    try {
      const result = await reportClient.exportCsv(company.activeCompany.id, filters, {
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      const url = URL.createObjectURL(result.blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `orbis-task-report-${company.activeCompany.id}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setExportError(true);
    } finally {
      if (exportController.current === controller) exportController.current = null;
      setDownloading(false);
    }
  }
  if (company.status !== "ready" || !company.activeCompany)
    return (
      <AppShell>
        <section className="mx-auto max-w-7xl py-10">
          <h1 className="sr-only">Relatórios</h1>
          {company.status === "error" ? (
            <ErrorState message="Não foi possível carregar suas empresas." />
          ) : company.status === "ready" ? (
            <EmptyState
              title="Nenhuma empresa disponível"
              description="Sua conta não possui uma empresa autorizada."
            />
          ) : (
            <LoadingState label="Carregando empresa ativa..." />
          )}
        </section>
      </AppShell>
    );
  return (
    <AppShell>
      <main className="mx-auto max-w-7xl py-2 sm:py-6" aria-labelledby="reports-title">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">
              Análise operacional · {company.activeCompany.name}
            </p>
            <h1 id="reports-title" className="mt-1 text-3xl font-semibold tracking-tight">
              Relatório de Tasks
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Emissão, entrega e horas apontadas, sem misturar estimativa da Requisição com
              execução.
            </p>
          </div>
          <Button
            className="h-11"
            variant="outline"
            onClick={() => void download()}
            disabled={downloading}
          >
            <Download className="mr-2 size-4" />
            {downloading ? "Exportando..." : "Exportar CSV"}
          </Button>
          {exportError && (
            <p className="mt-2 text-sm text-destructive" role="alert">
              Não foi possível exportar o CSV. Tente novamente.
            </p>
          )}
        </header>
        <Filters
          filters={filters}
          companyId={company.activeCompany.id}
          canLookupMembers={capabilities.data?.capabilities["users.read"] === true}
          canLookupRequisitions={capabilities.data?.capabilities["requisitions.read"] === true}
          onChange={(next) => {
            setFilters(next);
            setPage(1);
          }}
        />
        <p className="sr-only" role="status" aria-live="polite">
          {report.isPending
            ? "Carregando relatório"
            : report.isError
              ? "Erro ao carregar relatório"
              : "Relatório carregado"}
        </p>
        {report.isPending ? (
          <LoadingState label="Carregando relatório..." />
        ) : report.isError ? (
          <ErrorState
            message="Não foi possível carregar o relatório. Verifique seus filtros e acesso."
            onRetry={() => void report.refetch()}
          />
        ) : !report.data || report.data.items.length === 0 ? (
          <EmptyState
            title="Nenhuma Task encontrada"
            description="Ajuste os filtros ou consulte outro período."
          />
        ) : (
          <ReportContent
            items={report.data.items}
            total={report.data.total}
            page={page}
            hasMore={report.data.hasMore}
            onPage={setPage}
          />
        )}
      </main>
    </AppShell>
  );
}

function Filters({
  filters,
  companyId,
  canLookupMembers,
  canLookupRequisitions,
  onChange,
}: {
  filters: TaskReportFilters;
  companyId: string;
  canLookupMembers: boolean;
  canLookupRequisitions: boolean;
  onChange: (value: TaskReportFilters) => void;
}) {
  const set = (key: keyof TaskReportFilters, value: string) =>
    onChange({ ...filters, [key]: value || undefined });
  return (
    <section className="my-6 rounded-xl border bg-card p-4" aria-label="Filtros do relatório">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="grid gap-1 text-xs font-medium text-muted-foreground">
          Período inicial
          <input
            className={field}
            type="date"
            value={filters.periodStart ?? ""}
            onChange={(e) => set("periodStart", e.target.value)}
          />
        </label>
        <label className="grid gap-1 text-xs font-medium text-muted-foreground">
          Período final
          <input
            className={field}
            type="date"
            value={filters.periodEnd ?? ""}
            onChange={(e) => set("periodEnd", e.target.value)}
          />
        </label>
        {canLookupRequisitions ? (
          <IdLookupField
            label="Requisition"
            value={filters.requisitionId ?? ""}
            displayValue={null}
            lookup={createRequisitionLookup(companyId)}
            onChange={(item) => set("requisitionId", item?.id ?? "")}
          />
        ) : (
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            Requisition ID
            <input
              className={field}
              value={filters.requisitionId ?? ""}
              onChange={(e) => set("requisitionId", e.target.value)}
            />
          </label>
        )}
        {canLookupMembers ? (
          <IdLookupField
            label="Funcionário"
            value={filters.employeeId ?? ""}
            displayValue={null}
            lookup={createMemberLookup(companyId)}
            onChange={(item) => set("employeeId", item?.id ?? "")}
          />
        ) : (
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            Funcionário ID
            <input
              className={field}
              value={filters.employeeId ?? ""}
              onChange={(e) => set("employeeId", e.target.value)}
            />
          </label>
        )}
        <label className="grid gap-1 text-xs font-medium text-muted-foreground">
          Status
          <select
            className={field}
            value={filters.status ?? ""}
            onChange={(e) => set("status", e.target.value)}
          >
            <option value="">Todos</option>
            {REPORT_STATUSES.map((value) => (
              <option key={value} value={value}>
                {labels[value]}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-medium text-muted-foreground">
          Prioridade
          <select
            className={field}
            value={filters.priority ?? ""}
            onChange={(e) => set("priority", e.target.value)}
          >
            <option value="">Todas</option>
            {REPORT_PRIORITIES.map((value) => (
              <option key={value} value={value}>
                {labels[value]}
              </option>
            ))}
          </select>
        </label>
        <Button
          className="h-11 sm:col-span-2 lg:col-span-3 lg:justify-self-start"
          variant="ghost"
          disabled={Object.keys(filters).length === 0}
          onClick={() => onChange({})}
        >
          <RotateCcw className="mr-2 size-4" />
          Limpar filtros
        </Button>
      </div>
    </section>
  );
}

function ReportContent({
  items,
  total,
  page,
  hasMore,
  onPage,
}: {
  items: TaskReportItem[];
  total: number;
  page: number;
  hasMore: boolean;
  onPage: (page: number) => void;
}) {
  return (
    <section aria-label="Resultados do relatório">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">
          {total} {total === 1 ? "Task" : "Tasks"}
        </h2>
        <span className="text-xs text-muted-foreground">Página {page}</span>
      </div>
      <div className="hidden overflow-x-auto rounded-xl border md:block">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="bg-muted/50">
            <tr>
              {[
                "Status",
                "Prioridade",
                "Título",
                "Emissão",
                "Entrega planejada",
                "Entrega real",
                "Funcionário",
                "Estimativa",
                "Horas realizadas",
              ].map((head) => (
                <th className="px-4 py-3 font-medium" key={head}>
                  {head}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr className="border-t" key={item.id}>
                <Cell item={item} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-3 md:hidden">
        {items.map((item) => (
          <article className="rounded-xl border bg-card p-4" key={item.id}>
            <h3 className="font-medium break-words">{item.title}</h3>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <strong>Status: {labels[item.status]}</strong>
              <strong>Prioridade: {labels[item.priority]}</strong>
              <span>Emissão: {formatInstant(item.issuedAt)}</span>
              <span>Entrega: {item.plannedEndDate ?? "Não definida"}</span>
              <span>
                Real: {item.completedAt ? formatInstant(item.completedAt) : "Não entregue"}
              </span>
              <span>Funcionário: {item.assigneeName ?? item.assigneeId ?? "Não atribuído"}</span>
              <span>Estimativa: {hours(item.estimatedHours)}</span>
              <span>Realizadas: {hours(item.workedHours)}</span>
            </div>
          </article>
        ))}
      </div>
      <nav className="mt-4 flex justify-between gap-3" aria-label="Paginação do relatório">
        <Button
          className="h-11"
          variant="outline"
          disabled={page === 1}
          onClick={() => onPage(page - 1)}
        >
          Anterior
        </Button>
        <Button
          className="h-11"
          variant="outline"
          disabled={!hasMore}
          onClick={() => onPage(page + 1)}
        >
          Próxima
        </Button>
      </nav>
    </section>
  );
}
function Cell({ item }: { item: TaskReportItem }) {
  return (
    <>
      <td className="px-4 py-3">{labels[item.status]}</td>
      <td className="px-4 py-3">{labels[item.priority]}</td>
      <td className="max-w-[260px] break-words px-4 py-3 font-medium">{item.title}</td>
      <td className="px-4 py-3">{formatInstant(item.issuedAt)}</td>
      <td className="px-4 py-3">{item.plannedEndDate ?? "Não definida"}</td>
      <td className="px-4 py-3">
        {item.completedAt ? formatInstant(item.completedAt) : "Não entregue"}
      </td>
      <td className="px-4 py-3">{item.assigneeName ?? item.assigneeId ?? "Não atribuído"}</td>
      <td className="px-4 py-3">{hours(item.estimatedHours)}</td>
      <td className="px-4 py-3">{hours(item.workedHours)}</td>
    </>
  );
}
function hours(value: number | null) {
  return value === null ? "Não informada" : `${value.toFixed(2)} h`;
}
function formatInstant(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(
    new Date(value),
  );
}
