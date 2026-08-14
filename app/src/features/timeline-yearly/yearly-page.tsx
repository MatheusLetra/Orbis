import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { useState } from "react";
import { AppShell } from "@/app/layouts/app-shell";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { LoadingState } from "@/components/common/loading-state";
import { Button } from "@/components/ui/button";
import { useActiveCompany } from "@/features/companies/active-company-provider";
import {
  REQUISITION_PRIORITIES,
  REQUISITION_STATUSES,
} from "@/features/requisitions/requisition-contracts";
import type { YearlyFilters, YearlyItem, YearlyMonth, YearlyTimeline } from "./yearly-contracts";
import { useYearlyTimeline } from "./yearly-queries";

const PRIORITY_LABELS = { LOW: "Baixa", MEDIUM: "Média", HIGH: "Alta" } as const;
const STATUS_LABELS = {
  OPEN: "Aberta",
  IN_PROGRESS: "Em andamento",
  PAUSED: "Pausada",
  DONE: "Concluída",
  CANCELLED: "Cancelada",
} as const;

export function YearlyTimelinePage() {
  const company = useActiveCompany();
  const [year, setYear] = useState(String(new Date().getUTCFullYear()));
  const [filters, setFilters] = useState<YearlyFilters>({});
  const timeline = useYearlyTimeline(company.activeCompany?.id ?? null, year, filters);
  if (company.status !== "ready" || !company.activeCompany) {
    return (
      <AppShell>
        <section className="mx-auto max-w-7xl py-10">
          <h1 className="sr-only">Timeline anual</h1>
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
  const assigneeIds = [
    ...new Set(
      (timeline.data?.months ?? [])
        .flatMap((month) => [...month.items, ...month.undatedItems])
        .map((item) => item.assigneeId)
        .filter((id): id is string => id !== null),
    ),
  ].sort();
  const hasItems = (timeline.data?.months ?? []).some(
    (month) => month.items.length + month.undatedItems.length > 0,
  );
  return (
    <AppShell>
      <main className="mx-auto max-w-7xl py-2 sm:py-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">
              Planejamento · {company.activeCompany.name}
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">Timeline anual</h1>
          </div>
          <YearNavigation year={year} onChange={setYear} />
        </header>
        <Filters filters={filters} assigneeIds={assigneeIds} onChange={setFilters} />
        <p className="sr-only" role="status" aria-live="polite">
          {timeline.isPending
            ? "Carregando timeline anual"
            : timeline.isError
              ? "Erro ao carregar timeline anual"
              : "Timeline anual carregada"}
        </p>
        {timeline.isPending ? (
          <LoadingState label="Carregando timeline anual..." />
        ) : timeline.isError ? (
          <ErrorState
            message="Não foi possível carregar a timeline anual."
            onRetry={() => void timeline.refetch()}
          />
        ) : !timeline.data || !hasItems ? (
          <EmptyState
            title="Nenhuma requisição neste ano"
            description="Ajuste os filtros ou consulte outro ano."
          />
        ) : (
          <YearlyContent timeline={timeline.data} />
        )}
      </main>
    </AppShell>
  );
}

function YearNavigation({ year, onChange }: { year: string; onChange: (year: string) => void }) {
  return (
    <nav aria-label="Navegação entre anos" className="flex items-center gap-2">
      <Button
        className="h-11 w-11"
        variant="outline"
        size="icon"
        aria-label="Ano anterior"
        onClick={() => onChange(String(Number(year) - 1))}
      >
        <ChevronLeft />
      </Button>
      <Button
        className="h-11"
        variant="outline"
        onClick={() => onChange(String(new Date().getUTCFullYear()))}
      >
        Ano atual
      </Button>
      <span className="min-w-16 text-center text-sm font-medium" aria-live="polite">
        {year}
      </span>
      <Button
        className="h-11 w-11"
        variant="outline"
        size="icon"
        aria-label="Próximo ano"
        onClick={() => onChange(String(Number(year) + 1))}
      >
        <ChevronRight />
      </Button>
    </nav>
  );
}

function Filters({
  filters,
  assigneeIds,
  onChange,
}: {
  filters: YearlyFilters;
  assigneeIds: string[];
  onChange: (filters: YearlyFilters) => void;
}) {
  const selectClass =
    "h-11 min-w-0 rounded-md border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  return (
    <section className="my-6 rounded-xl border bg-card p-4" aria-label="Filtros da timeline anual">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto]">
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
        <label className="grid gap-1 text-xs font-medium text-muted-foreground">
          Status
          <select
            className={selectClass}
            aria-label="Status"
            value={filters.status ?? ""}
            onChange={(event) =>
              onChange({
                ...filters,
                status: (event.target.value || undefined) as YearlyFilters["status"],
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
                priority: (event.target.value || undefined) as YearlyFilters["priority"],
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
          disabled={!filters.priority && !filters.assigneeId && !filters.status}
          onClick={() => onChange({})}
        >
          <RotateCcw className="mr-2 size-4" />
          Limpar filtros
        </Button>
      </div>
    </section>
  );
}

function YearlyContent({ timeline }: { timeline: YearlyTimeline }) {
  return (
    <section aria-label={`Itens da timeline anual de ${timeline.year}`}>
      <div className="grid gap-3">
        {timeline.months.map((month) => (
          <MonthSection key={month.period} month={month} />
        ))}
      </div>
      <Indicators timeline={timeline} />
    </section>
  );
}

function MonthSection({ month }: { month: YearlyMonth }) {
  const [expanded, setExpanded] = useState(month.items.length + month.undatedItems.length > 0);
  return (
    <section className="rounded-xl border bg-card">
      <h2>
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 p-4 text-left font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-expanded={expanded}
          aria-controls={`yearly-month-${month.period}`}
          onClick={() => setExpanded((value) => !value)}
        >
          <span>{formatMonth(month.period)}</span>
          <span className="text-sm text-muted-foreground">
            {month.requisitionCount} requisições · {month.estimatedHours}h
          </span>
        </button>
      </h2>
      {expanded && (
        <div id={`yearly-month-${month.period}`} className="border-t p-4">
          <div className="mb-4 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
            <span>Baixa: {month.countsByPriority.LOW}</span>
            <span>Média: {month.countsByPriority.MEDIUM}</span>
            <span>Alta: {month.countsByPriority.HIGH}</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {month.items.map((item) => (
              <YearlyCard key={item.requisitionId} item={item} />
            ))}
          </div>
          {month.undatedItems.length > 0 && (
            <section
              className="mt-4 rounded-lg border border-dashed p-3"
              aria-label={`Requisições sem data em ${month.period}`}
            >
              <h3 className="mb-2 text-sm font-semibold">Sem data</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {month.undatedItems.map((item) => (
                  <YearlyCard key={item.requisitionId} item={item} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </section>
  );
}

function YearlyCard({ item }: { item: YearlyItem }) {
  return (
    <article
      className="rounded-lg border-l-4 bg-background p-3"
      aria-label={`${item.title}, prioridade ${PRIORITY_LABELS[item.priority]}`}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium">{item.title}</h3>
        <span className="text-xs text-muted-foreground">#{item.number}</span>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{item.assigneeId ?? "Sem responsável"}</p>
      <div className="mt-2 grid gap-1 text-xs">
        <p>Início: {item.startDate ?? "Sem data"}</p>
        <p>Entrega: {item.plannedDeliveryDate ?? "Sem data"}</p>
        {item.deliveredAt && (
          <p>
            Entregue: {new Date(item.deliveredAt).toLocaleDateString("pt-BR", { timeZone: "UTC" })}
          </p>
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-1 text-[11px]">
        <span className="rounded bg-muted px-1.5 py-0.5">{PRIORITY_LABELS[item.priority]}</span>
        {item.isOverdue && (
          <span className="rounded bg-destructive/10 px-1.5 py-0.5 font-medium text-destructive">
            Em atraso
          </span>
        )}
        {item.deliveredOnTime && (
          <span className="rounded bg-muted px-1.5 py-0.5">Entregue no prazo</span>
        )}
      </div>
    </article>
  );
}

function Indicators({ timeline }: { timeline: YearlyTimeline }) {
  const entries = [
    ["totalRequisitions", "Total de requisições"],
    ["estimatedHours", "Horas estimadas"],
    ["deliveredOnTime", "Entregues no prazo"],
    ["overdue", "Em atraso"],
  ] as const;
  return (
    <section className="mt-6" aria-labelledby="yearly-indicators-title">
      <h2 id="yearly-indicators-title" className="mb-3 text-sm font-semibold">
        Indicadores anuais
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {entries.map(([key, label]) => (
          <div className="rounded-xl border bg-card p-3" key={key}>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 text-xl font-semibold">{timeline.indicators[key]}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function formatMonth(period: string) {
  const [year, month] = period.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, 1)));
}
