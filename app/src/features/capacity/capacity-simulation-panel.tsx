import { useEffect, useRef, useState } from "react";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { LoadingState } from "@/components/common/loading-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CompanyCapabilities } from "@/features/companies/capabilities-contracts";
import { ApiError } from "@/lib/http/api-error";
import {
  type CapacitySimulationInput,
  type CapacitySimulationOutput,
  isValidCapacitySimulationInput,
} from "./capacity-contracts";
import { useCapacity } from "./capacity-queries";

interface CapacitySimulationPanelProps {
  companyId: string;
  capabilities: CompanyCapabilities | undefined;
  onCapabilitiesForbidden: () => void;
}

interface FormErrors {
  startDate?: string;
  estimatedHours?: string;
}

export function CapacitySimulationPanel({
  companyId,
  capabilities,
  onCapabilitiesForbidden,
}: CapacitySimulationPanelProps) {
  const [startDate, setStartDate] = useState("");
  const [estimatedHours, setEstimatedHours] = useState("");
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [submittedInput, setSubmittedInput] = useState<CapacitySimulationInput | null>(null);
  const firstInvalidRef = useRef<HTMLInputElement>(null);
  const estimatedHoursRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLElement>(null);
  const capacityQuery = useCapacity(companyId, capabilities, submittedInput, {
    onForbidden: onCapabilitiesForbidden,
  });

  const canReadCapacity =
    capabilities?.companyId === companyId && capabilities.capabilities["capacity.read"] === true;

  // Reset the local simulation whenever the active tenant changes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: tenant change resets the form lifecycle
  useEffect(() => {
    setStartDate("");
    setEstimatedHours("");
    setFormErrors({});
    setSubmittedInput(null);
  }, [companyId]);

  useEffect(() => {
    if (capacityQuery.data) resultRef.current?.focus();
  }, [capacityQuery.data]);

  if (!canReadCapacity) return null;

  function submit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const errors: FormErrors = {};
    const normalizedDate = startDate.trim();
    const parsedHours = estimatedHours.trim() === "" ? Number.NaN : Number(estimatedHours);
    const candidate = {
      startDate: `${normalizedDate}T00:00:00.000Z`,
      estimatedHours: parsedHours,
    };

    if (!isValidDateOnly(normalizedDate)) errors.startDate = "Informe uma data válida.";
    if (!Number.isFinite(parsedHours) || parsedHours < 0) {
      errors.estimatedHours = "Informe um número maior ou igual a zero.";
    }

    setFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      (errors.startDate ? firstInvalidRef : estimatedHoursRef).current?.focus();
      return;
    }

    if (isValidCapacitySimulationInput(candidate)) setSubmittedInput(candidate);
  }

  const errorMessage = capacityQuery.isError ? capacityErrorMessage(capacityQuery.error) : null;

  return (
    <section
      aria-labelledby="capacity-simulation-title"
      className="mt-10 overflow-hidden rounded-xl border bg-card shadow-sm"
    >
      <div className="border-b bg-muted/20 p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          Planejamento
        </p>
        <h2 id="capacity-simulation-title" className="mt-2 text-xl font-semibold tracking-tight">
          Simulação de capacidade
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Consulte uma previsão temporária com os parâmetros informados. O resultado não é salvo nem
          altera o trabalho da empresa.
        </p>
      </div>

      <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <form className="space-y-5" onSubmit={submit} noValidate>
          <div className="space-y-2">
            <Label htmlFor="capacity-start-date">Data inicial</Label>
            <Input
              ref={firstInvalidRef}
              id="capacity-start-date"
              type="date"
              value={startDate}
              aria-invalid={Boolean(formErrors.startDate)}
              aria-describedby={formErrors.startDate ? "capacity-start-date-error" : undefined}
              onChange={(event) => {
                setStartDate(event.target.value);
                setFormErrors((current) => ({ ...current, startDate: undefined }));
              }}
            />
            {formErrors.startDate && (
              <p id="capacity-start-date-error" className="text-sm text-destructive" role="alert">
                {formErrors.startDate}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="capacity-estimated-hours">Horas estimadas</Label>
            <Input
              ref={estimatedHoursRef}
              id="capacity-estimated-hours"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={estimatedHours}
              aria-invalid={Boolean(formErrors.estimatedHours)}
              aria-describedby={
                formErrors.estimatedHours ? "capacity-estimated-hours-error" : undefined
              }
              onChange={(event) => {
                setEstimatedHours(event.target.value);
                setFormErrors((current) => ({ ...current, estimatedHours: undefined }));
              }}
            />
            {formErrors.estimatedHours && (
              <p
                id="capacity-estimated-hours-error"
                className="text-sm text-destructive"
                role="alert"
              >
                {formErrors.estimatedHours}
              </p>
            )}
          </div>

          <Button type="submit" className="w-full sm:w-auto" disabled={capacityQuery.isFetching}>
            {capacityQuery.isFetching ? "Calculando..." : "Calcular simulação"}
          </Button>
        </form>

        <div className="min-w-0">
          {capacityQuery.isFetching && <LoadingState label="Calculando capacidade..." />}
          {capacityQuery.isError && errorMessage && (
            <ErrorState message={errorMessage} onRetry={() => void capacityQuery.refetch()} />
          )}
          {capacityQuery.data && (
            <CapacityResult resultRef={resultRef} output={capacityQuery.data} />
          )}
          {!capacityQuery.isFetching && !capacityQuery.isError && !capacityQuery.data && (
            <EmptyState
              title="Nenhuma simulação realizada"
              description="Informe a data inicial e as horas estimadas para consultar uma previsão."
            />
          )}
        </div>
      </div>
    </section>
  );
}

const CapacityResult = ({
  output,
  resultRef,
}: {
  output: CapacitySimulationOutput | undefined;
  resultRef: React.RefObject<HTMLElement | null>;
}) => {
  if (!output) return null;
  const metrics = [
    ["Desenvolvedores disponíveis", output.availableDevelopers.toLocaleString("pt-BR")],
    ["Horas diárias por desenvolvedor", formatNumber(output.dailyHoursPerDeveloper)],
    ["Capacidade diária", formatNumber(output.dailyCapacity)],
    ["Horas estimadas", formatNumber(output.estimatedHours)],
    ["Dias necessários", formatNumber(output.requiredDays)],
    ["Data inicial utilizada", formatDate(output.startDate)],
    ["Data prevista", formatDate(output.plannedDeliveryDate)],
  ];

  return (
    <section
      ref={resultRef}
      tabIndex={-1}
      aria-labelledby="capacity-result-title"
      className="rounded-lg border bg-background p-4 outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            Resultado
          </p>
          <h3 id="capacity-result-title" className="mt-1 text-lg font-semibold">
            Simulação de capacidade
          </h3>
        </div>
        <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
          Não persistida
        </span>
      </div>
      <dl className="mt-5 grid min-w-0 gap-3 sm:grid-cols-2">
        {metrics.map(([label, value]) => (
          <div key={label} className="min-w-0 rounded-md border p-3">
            <dt className="break-words text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-1 break-words text-base font-medium">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-xs leading-5 text-muted-foreground">
        Esta previsão foi calculada pelo backend e não altera Tasks, Requisitions, TimeEntries ou
        pausas.
      </p>
    </section>
  );
};

function isValidDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function formatNumber(value: number): string {
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(value));
}

function capacityErrorMessage(error: Error): string {
  if (error instanceof ApiError) {
    if (error.code === "CAPACITY_CONFIGURATION_MISSING") {
      return "A capacidade diária desta empresa ainda não foi configurada.";
    }
    if (error.code === "CAPACITY_ZERO") {
      return "Não há desenvolvedores elegíveis para esta simulação.";
    }
    if (error.status === 403) return "Você não possui acesso à capacidade desta empresa.";
    if (error.status === 404) return "A empresa não foi encontrada.";
    if (error.status === 400) return "Confira os parâmetros informados e tente novamente.";
    if (error.status === 422) return "Confira os parâmetros informados e tente novamente.";
    if (error.status >= 500) return "Não foi possível calcular agora. Tente novamente.";
    return error.message;
  }
  return "Não foi possível calcular a simulação. Tente novamente.";
}
