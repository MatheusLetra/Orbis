import { ChevronLeft, ChevronRight, Clock3, RotateCcw } from "lucide-react";
import { useState } from "react";
import { AppShell } from "@/app/layouts/app-shell";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { IdLookupField } from "@/components/common/id-lookup-field";
import { LoadingState } from "@/components/common/loading-state";
import { Button } from "@/components/ui/button";
import { useActiveCompany } from "@/features/companies/active-company-provider";
import { useCompanyCapabilities } from "@/features/companies/capabilities-queries";
import { createMemberLookup } from "@/features/lookups/lookup-adapters";
import {
  REQUISITION_PRIORITIES,
  REQUISITION_STATUSES,
} from "@/features/requisitions/requisition-contracts";
import type { MonthlyFilters, MonthlyItem, MonthlyTimeline } from "./monthly-contracts";
import { useMonthlyTimeline } from "./monthly-queries";

const PRIORITY_LABELS = { LOW: "Baixa", MEDIUM: "Média", HIGH: "Alta" } as const;
const STATUS_LABELS = {
  OPEN: "Aberta",
  IN_PROGRESS: "Em andamento",
  PAUSED: "Pausada",
  DONE: "Concluída",
  CANCELLED: "Cancelada",
} as const;

export function MonthlyTimelinePage() {
  const company = useActiveCompany();
  const capabilities = useCompanyCapabilities(company.activeCompany?.id ?? null);
  const [period, setPeriod] = useState(currentPeriod);
  const [filters, setFilters] = useState<MonthlyFilters>({});
  const timeline = useMonthlyTimeline(company.activeCompany?.id ?? null, period, filters);

  if (company.status !== "ready" || !company.activeCompany) {
    return (
      <AppShell>
        <section className="mx-auto max-w-7xl py-10">
          <h1 className="sr-only">Timeline mensal</h1>
          {company.status === "error" ? (
            <ErrorState message="Não foi possível carregar suas empresas." />
          ) : company.status === "ready" ? (
            <EmptyState
              title="Nenhuma empresa disponível"
              description="Sua conta ainda não possui uma empresa autorizada."
            />
          ) : (
            <LoadingState label="Carregando empresa ativa..." />
          )}
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <main className="mx-auto max-w-7xl py-2 sm:py-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">
              Planejamento · {company.activeCompany.name}
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">Timeline mensal</h1>
          </div>
          <MonthNavigation period={period} onChange={setPeriod} />
        </header>
        <Filters
          filters={filters}
          companyId={company.activeCompany.id}
          canLookupMembers={capabilities.data?.capabilities["users.read"] === true}
          assigneeIds={getAssigneeIds(timeline.data)}
          onChange={setFilters}
        />
        <p className="sr-only" role="status" aria-live="polite">
          {timeline.isPending
            ? "Carregando timeline mensal"
            : timeline.isError
              ? "Erro ao carregar timeline mensal"
              : "Timeline mensal carregada"}
        </p>
        {timeline.isPending ? (
          <LoadingState label="Carregando timeline mensal..." />
        ) : timeline.isError ? (
          <ErrorState
            message="Não foi possível carregar a timeline mensal."
            onRetry={() => void timeline.refetch()}
          />
        ) : !timeline.data ||
          timeline.data.items.length + timeline.data.undatedItems.length === 0 ? (
          <EmptyState
            title="Nenhuma requisição neste mês"
            description="Ajuste os filtros ou consulte outro mês."
          />
        ) : (
          <MonthlyContent timeline={timeline.data} />
        )}
      </main>
    </AppShell>
  );
}

function MonthNavigation({
  period,
  onChange,
}: {
  period: string;
  onChange: (value: string) => void;
}) {
  return (
    <nav aria-label="Navegação entre meses" className="flex items-center gap-2">
      <Button
        className="h-11 w-11"
        variant="outline"
        size="icon"
        aria-label="Mês anterior"
        onClick={() => onChange(addMonth(period, -1))}
      >
        <ChevronLeft />
      </Button>
      <Button className="h-11" variant="outline" onClick={() => onChange(currentPeriod())}>
        Mês atual
      </Button>
      <Button
        className="h-11 w-11"
        variant="outline"
        size="icon"
        aria-label="Próximo mês"
        onClick={() => onChange(addMonth(period, 1))}
      >
        <ChevronRight />
      </Button>
    </nav>
  );
}

function Filters({
  filters,
  companyId,
  canLookupMembers,
  assigneeIds,
  onChange,
}: {
  filters: MonthlyFilters;
  companyId: string;
  canLookupMembers: boolean;
  assigneeIds: string[];
  onChange: (value: MonthlyFilters) => void;
}) {
  const selectClass =
    "h-11 min-w-0 rounded-md border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  return (
    <section className="my-6 rounded-xl border bg-card p-4" aria-label="Filtros da timeline mensal">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto]">
        {canLookupMembers ? (
          <IdLookupField
            label="Responsável"
            value={filters.assigneeId ?? ""}
            displayValue={null}
            lookup={createMemberLookup(companyId)}
            onChange={(item) => onChange({ ...filters, assigneeId: item?.id || undefined })}
          />
        ) : (
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            Responsável
            <select
              className={selectClass}
              aria-label="Responsável"
              value={filters.assigneeId ?? ""}
              onChange={(event) =>
                onChange({ ...filters, assigneeId: event.target.value || undefined })
              }
            >
              <option value="">Todos</option>
              {assigneeIds.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="grid gap-1 text-xs font-medium text-muted-foreground">
          Status
          <select
            className={selectClass}
            aria-label="Status"
            value={filters.status ?? ""}
            onChange={(event) =>
              onChange({
                ...filters,
                status: (event.target.value || undefined) as MonthlyFilters["status"],
              })
            }
          >
            <option value="">Todos</option>
            {REQUISITION_STATUSES.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-medium text-muted-foreground">
          Prioridade
          <select
            className={selectClass}
            aria-label="Prioridade"
            value={filters.priority ?? ""}
            onChange={(event) =>
              onChange({
                ...filters,
                priority: (event.target.value || undefined) as MonthlyFilters["priority"],
              })
            }
          >
            <option value="">Todas</option>
            {REQUISITION_PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {PRIORITY_LABELS[priority]}
              </option>
            ))}
          </select>
        </label>
        <Button
          className="h-11 self-end"
          variant="ghost"
          disabled={!hasFilters(filters)}
          onClick={() => onChange({})}
        >
          <RotateCcw className="mr-2 size-4" />
          Limpar filtros
        </Button>
      </div>
    </section>
  );
}

function MonthlyContent({ timeline }: { timeline: MonthlyTimeline }) {
  const dated = [...timeline.items].sort((a, b) =>
    (a.startDate ?? a.plannedDeliveryDate ?? "").localeCompare(
      b.startDate ?? b.plannedDeliveryDate ?? "",
    ),
  );
  return (
    <section aria-label={`Itens da timeline mensal de ${timeline.period}`}>
      <h2 className="mb-3 text-sm font-medium">{formatMonth(timeline.period)}</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {dated.map((item) => (
          <MonthlyCard key={`${item.requisitionId}-${item.number}`} item={item} />
        ))}
      </div>
      {timeline.undatedItems.length > 0 && (
        <section
          className="mt-6 rounded-xl border border-dashed p-4"
          aria-labelledby="monthly-undated-title"
        >
          <h2
            id="monthly-undated-title"
            className="mb-3 flex items-center gap-2 text-sm font-semibold"
          >
            <Clock3 className="size-4" />
            Sem data
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {timeline.undatedItems.map((item) => (
              <MonthlyCard key={`${item.requisitionId}-${item.number}`} item={item} />
            ))}
          </div>
        </section>
      )}
      <Indicators indicators={timeline.indicators} />
    </section>
  );
}

function MonthlyCard({ item }: { item: MonthlyItem }) {
  const assignee = item.assigneeName ?? item.assigneeId ?? "Sem responsável";
  return (
    <article
      className={`rounded-lg border-l-4 bg-card p-3 shadow-sm ${priorityClass(item.priority)}`}
      aria-label={`${item.title}, prioridade ${PRIORITY_LABELS[item.priority]}`}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium leading-snug">{item.title}</h3>
        <span className="shrink-0 text-xs text-muted-foreground">#{item.number}</span>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{assignee}</p>
      <div className="mt-2 grid gap-1 text-xs">
        <p>Início: {item.startDate ? formatDate(item.startDate) : "Sem data"}</p>
        <p>
          Entrega: {item.plannedDeliveryDate ? formatDate(item.plannedDeliveryDate) : "Sem data"}
        </p>
        {item.deliveredAt && <p>Entregue: {formatInstant(item.deliveredAt)}</p>}
      </div>
      <div className="mt-2 flex flex-wrap gap-1 text-[11px]">
        <span className="rounded bg-muted px-1.5 py-0.5">{PRIORITY_LABELS[item.priority]}</span>
        {item.isOverdue && (
          <span className="rounded bg-destructive/10 px-1.5 py-0.5 font-medium text-destructive">
            Em atraso
          </span>
        )}
        <span className="rounded bg-muted px-1.5 py-0.5">
          {item.deliveredOnTime ? "Entregue no prazo" : "Entregue fora do prazo"}
        </span>
      </div>
    </article>
  );
}

function Indicators({ indicators }: { indicators: MonthlyTimeline["indicators"] }) {
  const entries = [
    ["totalRequisitions", "Total de requisições"],
    ["estimatedHours", "Horas estimadas"],
    ["deliveredOnTime", "Entregues no prazo"],
    ["overdue", "Em atraso"],
  ] as const;
  return (
    <section className="mt-6" aria-labelledby="monthly-indicators-title">
      <h2 id="monthly-indicators-title" className="mb-3 text-sm font-semibold">
        Indicadores
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {entries.map(([key, label]) => (
          <div className="rounded-xl border bg-card p-3" key={key}>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 text-xl font-semibold">{indicators[key]}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function getAssigneeIds(timeline: MonthlyTimeline | undefined): string[] {
  if (!timeline) return [];
  return [
    ...new Set(
      [...timeline.items, ...timeline.undatedItems]
        .map((item) => item.assigneeId)
        .filter((id): id is string => id !== null),
    ),
  ].sort();
}
function priorityClass(priority: MonthlyItem["priority"]): string {
  return priority === "HIGH"
    ? "border-l-red-500"
    : priority === "MEDIUM"
      ? "border-l-orange-500"
      : "border-l-emerald-500";
}
function hasFilters(filters: MonthlyFilters): boolean {
  return Boolean(filters.priority || filters.assigneeId || filters.status);
}
function currentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}
function addMonth(period: string, amount: number): string {
  const date = new Date(
    Date.UTC(Number(period.slice(0, 4)), Number(period.slice(5, 7)) - 1 + amount, 1),
  );
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}
function formatMonth(period: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(Number(period.slice(0, 4)), Number(period.slice(5, 7)) - 1, 1)));
}
function formatDate(value: string): string {
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}
function formatInstant(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(
    new Date(value),
  );
}
