import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CirclePause,
  Clock3,
  TriangleAlert,
} from "lucide-react";
import { useState } from "react";
import { AppShell } from "@/app/layouts/app-shell";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { LoadingState } from "@/components/common/loading-state";
import { Button } from "@/components/ui/button";
import { useActiveCompany } from "@/features/companies/active-company-provider";
import { TASK_PRIORITIES, TASK_STATUSES } from "@/features/tasks/task-contracts";
import type { TimelineFilters, TimelineTask, WeeklyTimeline } from "./timeline-contracts";
import { addCalendarDays } from "./timeline-contracts";
import { useWeeklyTimeline } from "./timeline-queries";

const STATUS_LABELS = {
  TODO: "A fazer",
  IN_PROGRESS: "Em andamento",
  PAUSED: "Pausada",
  DONE: "Concluída",
} as const;
const PRIORITY_LABELS = { LOW: "Baixa", MEDIUM: "Média", HIGH: "Alta" } as const;

export function TimelinePage() {
  const company = useActiveCompany();
  const activeCompany = company.activeCompany;
  const [weekStart, setWeekStart] = useState(currentWeekStart);
  const [filters, setFilters] = useState<TimelineFilters>({});
  const timeline = useWeeklyTimeline(activeCompany?.id ?? null, weekStart, filters);

  if (company.status !== "ready" || !activeCompany) {
    return (
      <AppShell>
        <section className="mx-auto max-w-7xl py-10">
          <h1 className="sr-only">Timeline semanal</h1>
          {company.status === "error" ? (
            <ErrorState message="Não foi possível carregar suas empresas." />
          ) : company.status === "ready" && company.companies.length === 0 ? (
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
      <main className="mx-auto max-w-7xl py-8 sm:py-12">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Planejamento · {activeCompany.name}</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">Timeline semanal</h1>
          </div>
          <WeekNavigation weekStart={weekStart} onChange={setWeekStart} />
        </header>

        <Filters
          filters={filters}
          assignees={timeline.data?.assignees ?? []}
          onChange={setFilters}
        />

        <p className="sr-only" role="status" aria-live="polite">
          {timeline.isPending
            ? "Carregando timeline"
            : timeline.isError
              ? "Erro ao carregar timeline"
              : "Timeline carregada"}
        </p>
        {timeline.isPending ? (
          <LoadingState label="Carregando timeline..." />
        ) : timeline.isError ? (
          <ErrorState
            message="Não foi possível carregar a timeline."
            onRetry={() => void timeline.refetch()}
          />
        ) : totalTasks(timeline.data) === 0 ? (
          <EmptyState
            title="Nenhuma tarefa nesta semana"
            description="Ajuste os filtros ou consulte outra semana."
          />
        ) : (
          <TimelineGrid timeline={timeline.data} />
        )}
      </main>
    </AppShell>
  );
}

function WeekNavigation({
  weekStart,
  onChange,
}: {
  weekStart: string;
  onChange: (value: string) => void;
}) {
  return (
    <nav aria-label="Navegação entre semanas" className="flex items-center gap-2">
      <Button
        className="h-11 w-11"
        variant="outline"
        size="icon"
        aria-label="Semana anterior"
        onClick={() => onChange(addCalendarDays(weekStart, -7))}
      >
        <ChevronLeft />
      </Button>
      <Button className="h-11" variant="outline" onClick={() => onChange(currentWeekStart())}>
        Semana atual
      </Button>
      <Button
        className="h-11 w-11"
        variant="outline"
        size="icon"
        aria-label="Próxima semana"
        onClick={() => onChange(addCalendarDays(weekStart, 7))}
      >
        <ChevronRight />
      </Button>
    </nav>
  );
}

function Filters({
  filters,
  assignees,
  onChange,
}: {
  filters: TimelineFilters;
  assignees: WeeklyTimeline["assignees"];
  onChange: (value: TimelineFilters) => void;
}) {
  const selectClass =
    "h-11 rounded-md border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  return (
    <section className="my-6 rounded-xl border bg-card p-4" aria-label="Filtros da timeline">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto]">
        <label className="grid gap-1 text-xs font-medium text-muted-foreground">
          Responsável
          <select
            className={selectClass}
            value={filters.assigneeId ?? ""}
            onChange={(event) =>
              onChange({ ...filters, assigneeId: event.target.value || undefined })
            }
          >
            <option value="">Todos</option>
            {assignees.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-medium text-muted-foreground">
          Status
          <select
            className={selectClass}
            value={filters.status ?? ""}
            onChange={(event) =>
              onChange({
                ...filters,
                status: (event.target.value || undefined) as TimelineFilters["status"],
              })
            }
          >
            <option value="">Todos</option>
            {TASK_STATUSES.map((status) => (
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
            value={filters.priority ?? ""}
            onChange={(event) =>
              onChange({
                ...filters,
                priority: (event.target.value || undefined) as TimelineFilters["priority"],
              })
            }
          >
            <option value="">Todas</option>
            {TASK_PRIORITIES.map((priority) => (
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
          Limpar filtros
        </Button>
      </div>
    </section>
  );
}

function TimelineGrid({ timeline }: { timeline: WeeklyTimeline }) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-medium">
        {formatDate(timeline.weekStart)} a {formatDate(timeline.weekEnd)}
      </h2>
      <section
        className="overflow-x-auto rounded-xl border bg-muted/30"
        aria-label="Grade da timeline semanal; deslize horizontalmente para ver todos os dias"
      >
        <div className="grid min-w-[980px] grid-cols-5 divide-x">
          {timeline.days.map((day) => (
            <section
              key={day.date}
              className="min-h-72 p-3"
              aria-labelledby={`timeline-day-${day.date}`}
            >
              <h3
                id={`timeline-day-${day.date}`}
                className="mb-3 border-b pb-2 text-sm font-semibold capitalize"
              >
                {formatWeekday(day.date)}{" "}
                <span className="font-normal text-muted-foreground">
                  {formatShortDate(day.date)}
                </span>
              </h3>
              <TaskList tasks={day.tasks} emptyLabel="Sem tarefas" assignees={timeline.assignees} />
            </section>
          ))}
        </div>
      </section>
      <SpecialTaskSection
        id="overdue"
        title="Em atraso"
        icon={<TriangleAlert className="size-4" />}
        tasks={timeline.overdueTasks}
        assignees={timeline.assignees}
      />
      <SpecialTaskSection
        id="weekend"
        title="Fim de semana"
        icon={<CalendarDays className="size-4" />}
        tasks={timeline.weekendTasks}
        assignees={timeline.assignees}
      />
      <SpecialTaskSection
        id="undated"
        title="Sem data"
        icon={<Clock3 className="size-4" />}
        tasks={timeline.undatedTasks}
        assignees={timeline.assignees}
      />
    </section>
  );
}

function SpecialTaskSection({
  id,
  title,
  icon,
  tasks,
  assignees,
}: {
  id: string;
  title: string;
  icon: React.ReactNode;
  tasks: TimelineTask[];
  assignees: WeeklyTimeline["assignees"];
}) {
  if (tasks.length === 0) return null;
  return (
    <section className="mt-5 rounded-xl border border-dashed p-4" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="mb-3 flex items-center gap-2 text-sm font-semibold">
        {icon} {title}
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <TaskList tasks={tasks} assignees={assignees} />
      </div>
    </section>
  );
}

function TaskList({
  tasks,
  assignees,
  emptyLabel,
}: {
  tasks: TimelineTask[];
  assignees: WeeklyTimeline["assignees"];
  emptyLabel?: string;
}) {
  if (tasks.length === 0)
    return emptyLabel ? <p className="text-xs text-muted-foreground">{emptyLabel}</p> : null;
  return tasks.map((task) => {
    const assignee =
      assignees.find((item) => item.id === task.assigneeId)?.name ?? "Sem responsável";
    return (
      <article
        key={task.id}
        className={`mb-2 rounded-lg border-l-4 bg-card p-3 shadow-sm ${priorityClass(task.priority)} ${task.isPaused ? "border-dashed opacity-70" : ""}`}
        aria-label={`${task.title}, ${STATUS_LABELS[task.status]}, prioridade ${PRIORITY_LABELS[task.priority]}`}
      >
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-sm font-medium leading-snug">{task.title}</h4>
          {task.isPaused && (
            <CirclePause
              className="size-4 shrink-0 text-muted-foreground"
              aria-label="Tarefa pausada"
            />
          )}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{assignee}</p>
        <div className="mt-2 flex flex-wrap gap-1 text-[11px]">
          <span className="rounded bg-muted px-1.5 py-0.5">{STATUS_LABELS[task.status]}</span>
          {task.isOverdue && (
            <span className="rounded bg-destructive/10 px-1.5 py-0.5 font-medium text-destructive">
              Em atraso
            </span>
          )}
        </div>
      </article>
    );
  });
}

function currentWeekStart(): string {
  const now = new Date();
  const current = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return addCalendarDays(current, -((now.getDay() + 6) % 7));
}

function formatDate(value: string): string {
  return formatCalendar(value, { day: "2-digit", month: "short", year: "numeric" });
}
function formatShortDate(value: string): string {
  return formatCalendar(value, { day: "2-digit", month: "2-digit" });
}
function formatWeekday(value: string): string {
  return formatCalendar(value, { weekday: "long" });
}
function formatCalendar(value: string, options: Intl.DateTimeFormatOptions): string {
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  return new Intl.DateTimeFormat("pt-BR", { ...options, timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, day)),
  );
}
function priorityClass(priority: TimelineTask["priority"]): string {
  return priority === "HIGH"
    ? "border-l-red-500"
    : priority === "MEDIUM"
      ? "border-l-orange-500"
      : "border-l-emerald-500";
}
function totalTasks(timeline: WeeklyTimeline): number {
  return timeline.days.reduce(
    (total, day) => total + day.tasks.length,
    timeline.undatedTasks.length + timeline.overdueTasks.length + timeline.weekendTasks.length,
  );
}
function hasFilters(filters: TimelineFilters): boolean {
  return Boolean(filters.assigneeId || filters.status || filters.priority);
}
