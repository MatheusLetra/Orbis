import { describe, expect, it } from "vitest";
import { BusinessCalendar } from "@/modules/capacity/domain/services/business-calendar";
import { BusinessRuleError } from "@/shared/errors/typed-errors";

const calendar = new BusinessCalendar();

function date(value: string): Date {
  return new Date(`${value}T12:00:00.000Z`);
}

function utcDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

describe("BusinessCalendar.isBusinessDay", () => {
  it.each([
    ["segunda-feira", "2026-08-10", true],
    ["sexta-feira", "2026-08-14", true],
    ["sábado", "2026-08-15", false],
    ["domingo", "2026-08-16", false],
  ])("identifica %s", (_label, value, expected) => {
    expect(calendar.isBusinessDay(date(value))).toBe(expected);
  });

  it("rejeita um dia útil que foi fornecido como feriado", () => {
    expect(calendar.isBusinessDay(date("2026-08-10"), [date("2026-08-10")])).toBe(false);
  });

  it("aceita uma data válida sem feriado", () => {
    expect(calendar.isBusinessDay(date("2026-08-11"), [date("2026-08-10")])).toBe(true);
  });

  it("trata fronteiras de mês e virada de ano por data UTC", () => {
    expect(calendar.isBusinessDay(date("2026-02-28"))).toBe(false);
    expect(calendar.isBusinessDay(date("2026-03-02"))).toBe(true);
    expect(calendar.isBusinessDay(date("2026-12-31"))).toBe(true);
    expect(calendar.isBusinessDay(date("2027-01-01"))).toBe(true);
  });
});

describe("BusinessCalendar.addBusinessDays", () => {
  it("avança zero dias e retorna uma nova data sem mutar a original", () => {
    const original = date("2026-08-14");
    const originalTime = original.getTime();

    const result = calendar.addBusinessDays(original, 0);

    expect(result).not.toBe(original);
    expect(result.getTime()).toBe(originalTime);
    expect(original.getTime()).toBe(originalTime);
  });

  it("avança um dia útil", () => {
    expect(calendar.addBusinessDays(date("2026-08-10"), 1)).toEqual(date("2026-08-11"));
  });

  it("atravessa um fim de semana", () => {
    expect(calendar.addBusinessDays(date("2026-08-14"), 1)).toEqual(date("2026-08-17"));
  });

  it("atravessa múltiplos fins de semana", () => {
    expect(calendar.addBusinessDays(date("2026-08-14"), 10)).toEqual(date("2026-08-28"));
  });

  it.each([
    ["sábado", "2026-08-15", "2026-08-17"],
    ["domingo", "2026-08-16", "2026-08-17"],
  ])("iniciando em %s, avança a partir do próximo dia", (_label, start, expected) => {
    expect(calendar.addBusinessDays(date(start), 1)).toEqual(date(expected));
  });

  it("ignora feriado no caminho", () => {
    expect(calendar.addBusinessDays(date("2026-08-10"), 2, [date("2026-08-11")])).toEqual(
      date("2026-08-13"),
    );
  });

  it("ignora feriados consecutivos", () => {
    expect(
      calendar.addBusinessDays(date("2026-08-10"), 1, [date("2026-08-11"), date("2026-08-12")]),
    ).toEqual(date("2026-08-13"));
  });

  it("atravessa virada de mês e de ano", () => {
    expect(calendar.addBusinessDays(date("2026-01-30"), 1)).toEqual(date("2026-02-02"));
    expect(calendar.addBusinessDays(date("2026-12-31"), 1)).toEqual(date("2027-01-01"));
  });

  it("preserva o horário UTC da data original", () => {
    const original = new Date("2026-08-14T23:30:15.125Z");

    expect(calendar.addBusinessDays(original, 1)).toEqual(new Date("2026-08-17T23:30:15.125Z"));
    expect(original).toEqual(new Date("2026-08-14T23:30:15.125Z"));
  });

  it("não altera a coleção de feriados", () => {
    const holidays = [date("2026-08-11"), date("2026-08-12")];
    const snapshot = holidays.map((holiday) => holiday.getTime());

    calendar.addBusinessDays(date("2026-08-10"), 1, holidays);

    expect(holidays.map((holiday) => holiday.getTime())).toEqual(snapshot);
  });
});

describe("BusinessCalendar validações", () => {
  it.each([new Date("invalid"), null, "2026-08-10"])("rejeita data inválida: %s", (value) => {
    expect(() => calendar.isBusinessDay(value as never)).toThrow(BusinessRuleError);
    expect(() => calendar.addBusinessDays(value as never, 1)).toThrow(BusinessRuleError);
  });

  it.each([NaN, Infinity, 1.5, -1])("rejeita quantidade inválida: %s", (value) => {
    expect(() => calendar.addBusinessDays(date("2026-08-10"), value)).toThrow(BusinessRuleError);
  });

  it("rejeita coleção de feriados inválida ou com data inválida", () => {
    expect(() => calendar.isBusinessDay(date("2026-08-10"), null as never)).toThrow(
      BusinessRuleError,
    );
    expect(() => calendar.isBusinessDay(date("2026-08-10"), [new Date("invalid")])).toThrow(
      BusinessRuleError,
    );
    expect(() => calendar.addBusinessDays(date("2026-08-10"), 0, ["invalid"] as never)).toThrow(
      BusinessRuleError,
    );
  });

  it("usa o mesmo resultado independentemente do timezone local", () => {
    const input = new Date("2026-08-14T23:30:00-05:00");

    expect(calendar.addBusinessDays(input, 1)).toEqual(new Date("2026-08-17T04:30:00Z"));
    expect(calendar.isBusinessDay(new Date("2026-08-17T00:30:00-04:00"))).toBe(true);
  });

  it("usa datas UTC de feriados sem alterar seus objetos", () => {
    const holiday = utcDate("2026-08-17");
    const result = calendar.addBusinessDays(date("2026-08-14"), 1, [holiday]);

    expect(result).toEqual(date("2026-08-18"));
    expect(holiday).toEqual(utcDate("2026-08-17"));
  });
});
