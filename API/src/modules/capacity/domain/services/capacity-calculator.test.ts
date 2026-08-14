import { describe, expect, it, vi } from "vitest";
import { BusinessCalendar } from "@/modules/capacity/domain/services/business-calendar";
import {
  type CalculateCapacityInput,
  CapacityCalculator,
} from "@/modules/capacity/domain/services/capacity-calculator";
import { BusinessRuleError } from "@/shared/errors/typed-errors";

const calendar = new BusinessCalendar();

function date(value: string): Date {
  return new Date(`${value}T12:00:00.000Z`);
}

function input(overrides: Partial<CalculateCapacityInput> = {}): CalculateCapacityInput {
  return {
    startDate: date("2026-08-10"),
    estimatedHours: 8,
    availableDevelopers: 1,
    dailyHoursPerDeveloper: 8,
    ...overrides,
  };
}

function calculator(): CapacityCalculator {
  return new CapacityCalculator(calendar);
}

describe("CapacityCalculator", () => {
  it("calcula a capacidade de um desenvolvedor com oito horas", () => {
    expect(calculator().calculate(input())).toMatchObject({
      dailyCapacity: 8,
      requiredDays: 1,
    });
  });

  it("calcula a capacidade de múltiplos desenvolvedores", () => {
    expect(
      calculator().calculate(input({ availableDevelopers: 3, dailyHoursPerDeveloper: 7.5 })),
    ).toMatchObject({ dailyCapacity: 22.5, requiredDays: 8 / 22.5 });
  });

  it("aceita horas diárias fracionárias", () => {
    expect(calculator().calculate(input({ dailyHoursPerDeveloper: 6.5 }))).toMatchObject({
      dailyCapacity: 6.5,
      requiredDays: 8 / 6.5,
    });
  });

  it("preserva requiredDays fracionário e arredonda somente o avanço", () => {
    const addBusinessDays = vi.spyOn(calendar, "addBusinessDays");

    const result = calculator().calculate(input({ estimatedHours: 10 }));

    expect(result.requiredDays).toBe(1.25);
    expect(addBusinessDays).toHaveBeenCalledWith(
      expect.objectContaining({ getTime: expect.any(Function) }),
      2,
      undefined,
    );
    expect(result.plannedDeliveryDate).toEqual(date("2026-08-12"));
    addBusinessDays.mockRestore();
  });

  it("aceita estimativa zero sem avançar o calendário", () => {
    const addBusinessDays = vi.spyOn(calendar, "addBusinessDays");
    const startDate = date("2026-08-15");

    const result = calculator().calculate(input({ startDate, estimatedHours: 0 }));

    expect(result).toMatchObject({ dailyCapacity: 8, requiredDays: 0 });
    expect(result.plannedDeliveryDate).not.toBe(startDate);
    expect(result.plannedDeliveryDate).toEqual(startDate);
    expect(addBusinessDays).not.toHaveBeenCalled();
    addBusinessDays.mockRestore();
  });

  it("exclui o dia inicial ao iniciar em dia útil", () => {
    expect(calculator().calculate(input({ estimatedHours: 8 })).plannedDeliveryDate).toEqual(
      date("2026-08-11"),
    );
  });

  it("atravessa fim de semana ao iniciar na sexta-feira", () => {
    const result = calculator().calculate(input({ startDate: date("2026-08-14") }));

    expect(result.plannedDeliveryDate).toEqual(date("2026-08-17"));
  });

  it.each([
    ["sábado", "2026-08-15"],
    ["domingo", "2026-08-16"],
  ])("avança corretamente iniciando no %s", (_label, startDate) => {
    expect(
      calculator().calculate(input({ startDate: date(startDate) })).plannedDeliveryDate,
    ).toEqual(date("2026-08-17"));
  });

  it("considera feriado no caminho", () => {
    const result = calculator().calculate(
      input({ estimatedHours: 16, holidays: [date("2026-08-11")] }),
    );

    expect(result.plannedDeliveryDate).toEqual(date("2026-08-13"));
  });

  it("considera feriados consecutivos", () => {
    const result = calculator().calculate(
      input({ holidays: [date("2026-08-11"), date("2026-08-12")] }),
    );

    expect(result.plannedDeliveryDate).toEqual(date("2026-08-13"));
  });

  it("atravessa virada de mês e de ano", () => {
    expect(
      calculator().calculate(input({ startDate: date("2026-01-30") })).plannedDeliveryDate,
    ).toEqual(date("2026-02-02"));
    expect(
      calculator().calculate(input({ startDate: date("2026-12-31") })).plannedDeliveryDate,
    ).toEqual(date("2027-01-01"));
  });

  it("não muta a data inicial nem os feriados", () => {
    const startDate = date("2026-08-10");
    const holidays = [date("2026-08-11")];
    const startTime = startDate.getTime();
    const holidayTime = holidays[0]?.getTime();

    const result = calculator().calculate(input({ startDate, holidays }));

    expect(startDate.getTime()).toBe(startTime);
    expect(holidays[0]?.getTime()).toBe(holidayTime);
    expect(result.plannedDeliveryDate).not.toBe(startDate);
  });

  it("mantém resultado determinístico usando UTC", () => {
    const result = calculator().calculate(
      input({ startDate: new Date("2026-08-14T23:30:00-05:00") }),
    );

    expect(result.plannedDeliveryDate).toEqual(new Date("2026-08-16T23:30:00-05:00"));
  });
});

describe("CapacityCalculator validações", () => {
  it.each([0, -1, NaN, Infinity, -Infinity, 1.5])(
    "rejeita desenvolvedores inválidos: %s",
    (availableDevelopers) => {
      expect(() => calculator().calculate(input({ availableDevelopers }))).toThrow(
        BusinessRuleError,
      );
    },
  );

  it.each([0, -1, NaN, Infinity, -Infinity])(
    "rejeita horas diárias inválidas: %s",
    (dailyHoursPerDeveloper) => {
      expect(() => calculator().calculate(input({ dailyHoursPerDeveloper }))).toThrow(
        BusinessRuleError,
      );
    },
  );

  it.each([-1, NaN, Infinity, -Infinity])("rejeita estimativa inválida: %s", (estimatedHours) => {
    expect(() => calculator().calculate(input({ estimatedHours }))).toThrow(BusinessRuleError);
  });

  it.each([new Date("invalid"), null, "2026-08-10"])(
    "rejeita data inicial inválida: %s",
    (startDate) => {
      expect(() => calculator().calculate(input({ startDate: startDate as never }))).toThrow(
        BusinessRuleError,
      );
    },
  );

  it("rejeita feriado inválido", () => {
    expect(() => calculator().calculate(input({ holidays: [new Date("invalid")] }))).toThrow(
      BusinessRuleError,
    );
    expect(() =>
      calculator().calculate(input({ estimatedHours: 0, holidays: [null as never] })),
    ).toThrow(BusinessRuleError);
  });

  it("rejeita coleção de feriados inválida", () => {
    expect(() => calculator().calculate(input({ holidays: null as never }))).toThrow(
      BusinessRuleError,
    );
  });
});
