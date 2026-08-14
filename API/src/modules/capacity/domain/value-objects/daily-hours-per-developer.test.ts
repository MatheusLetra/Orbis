import { describe, expect, it } from "vitest";

import {
  assertDailyHoursPerDeveloper,
  MAX_DAILY_HOURS_PER_DEVELOPER,
  MIN_DAILY_HOURS_PER_DEVELOPER,
} from "@/modules/capacity/domain/value-objects/daily-hours-per-developer";
import { BusinessRuleError } from "@/shared/errors/typed-errors";

describe("dailyHoursPerDeveloper", () => {
  it.each([MIN_DAILY_HOURS_PER_DEVELOPER, 1, 7.5, 8, MAX_DAILY_HOURS_PER_DEVELOPER])(
    "aceita valor válido %s",
    (value) => {
      expect(assertDailyHoursPerDeveloper(value)).toBe(value);
    },
  );

  it.each([0, -1, 24.01, NaN, Infinity, -Infinity, 1.001])("rejeita valor inválido %s", (value) => {
    expect(() => assertDailyHoursPerDeveloper(value)).toThrow(BusinessRuleError);
  });
});
