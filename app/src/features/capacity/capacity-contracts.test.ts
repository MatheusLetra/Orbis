import { describe, expect, it } from "vitest";
import {
  isValidCapacitySimulationInput,
  parseCapacitySimulationOutput,
} from "./capacity-contracts";

const output = {
  companyId: "11111111-1111-4111-8111-111111111111",
  startDate: "2026-08-17T00:00:00.000Z",
  estimatedHours: 24,
  availableDevelopers: 3,
  dailyHoursPerDeveloper: 8,
  dailyCapacity: 24,
  requiredDays: 1,
  plannedDeliveryDate: "2026-08-18T00:00:00.000Z",
};

describe("capacity contracts", () => {
  it("aceita entrada e resposta válidas", () => {
    expect(isValidCapacitySimulationInput(output)).toBe(true);
    expect(parseCapacitySimulationOutput(output)).toEqual(output);
  });

  it.each([
    { ...output, companyId: "company-a" },
    { ...output, startDate: "invalid" },
    { ...output, plannedDeliveryDate: "invalid" },
    { ...output, estimatedHours: Number.NaN },
    { ...output, availableDevelopers: 1.5 },
    { ...output, dailyHoursPerDeveloper: 0 },
    { ...output, dailyCapacity: Number.POSITIVE_INFINITY },
    { ...output, requiredDays: -1 },
    { ...output, unexpected: true },
  ])("rejeita resposta inválida", (value) => {
    expect(() => parseCapacitySimulationOutput(value)).toThrow("Contrato de capacidade inválido");
  });

  it.each([
    { startDate: "2026-08-17T00:00:00.000Z", estimatedHours: -1 },
    { startDate: "2026-08-17", estimatedHours: 1 },
    { startDate: "invalid", estimatedHours: 1 },
    { startDate: "2026-08-17T00:00:00.000Z", estimatedHours: Number.POSITIVE_INFINITY },
  ])("rejeita entrada inválida", (value) => {
    expect(isValidCapacitySimulationInput(value)).toBe(false);
  });
});
