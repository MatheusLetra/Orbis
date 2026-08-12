import { describe, expect, it } from "vitest";

import { Requisition } from "@/modules/requisitions/domain/entities/requisition";
import {
  FakeRequisitionNumberGenerator,
  InMemoryRequisitionAssigneeRepository,
  InMemoryRequisitionRepository,
} from "@/test/fakes/requisition-fakes";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_COMPANY_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "33333333-3333-4333-8333-333333333333";
const OTHER_USER_ID = "44444444-4444-4444-8444-444444444444";

function requisition(
  companyId = COMPANY_ID,
  title = "Requisição",
  responsibleId?: string,
  priority: "LOW" | "MEDIUM" | "HIGH" = "MEDIUM",
) {
  return Requisition.create({
    companyId,
    number: 1,
    title,
    requesterId: USER_ID,
    responsibleId,
    priority,
  });
}

describe("InMemoryRequisitionRepository", () => {
  it("cria, encontra, atualiza e remove", async () => {
    const repository = new InMemoryRequisitionRepository();
    const item = requisition();
    await repository.create(item);
    expect(await repository.findById(item.id)).toBe(item);

    item.rename("Atualizada");
    await repository.update(item);
    expect((await repository.findById(item.id))?.title).toBe("Atualizada");

    await repository.delete(item.id);
    expect(await repository.findById(item.id)).toBeNull();
  });

  it("isola empresas, aplica filtros oficiais e ordena por createdAt", async () => {
    const repository = new InMemoryRequisitionRepository();
    const first = requisition(COMPANY_ID, "Primeira", USER_ID, "HIGH");
    await new Promise((resolve) => setTimeout(resolve, 2));
    const second = requisition(COMPANY_ID, "Segunda", OTHER_USER_ID, "LOW");
    const foreign = requisition(OTHER_COMPANY_ID, "Estrangeira");
    await repository.create(second);
    await repository.create(foreign);
    await repository.create(first);

    expect((await repository.listByCompany(COMPANY_ID)).map((item) => item.title)).toEqual([
      "Primeira",
      "Segunda",
    ]);
    expect((await repository.listByCompany(OTHER_COMPANY_ID)).map((item) => item.title)).toEqual([
      "Estrangeira",
    ]);
    expect(
      (await repository.listByCompany(COMPANY_ID, { priority: "HIGH" })).map((item) => item.id),
    ).toEqual([first.id]);
    expect(
      (await repository.listByCompany(COMPANY_ID, { responsibleId: OTHER_USER_ID })).map(
        (item) => item.id,
      ),
    ).toEqual([second.id]);
    expect((await repository.listByCompany(COMPANY_ID, { status: "OPEN" })).length).toBe(2);
  });
});

describe("InMemoryRequisitionAssigneeRepository", () => {
  it("cria sem duplicar, lista ordenado e remove de forma idempotente", async () => {
    const repository = new InMemoryRequisitionAssigneeRepository();
    const first = await repository.create(COMPANY_ID, "req-1", OTHER_USER_ID);
    const duplicate = await repository.create(COMPANY_ID, "req-1", OTHER_USER_ID);
    await repository.create(COMPANY_ID, "req-1", USER_ID);

    expect(duplicate).toBe(first);
    expect(
      (await repository.listByRequisition(COMPANY_ID, "req-1")).map((item) => item.userId),
    ).toEqual([USER_ID, OTHER_USER_ID]);
    expect(
      await repository.findByRequisitionAndUser(OTHER_COMPANY_ID, "req-1", OTHER_USER_ID),
    ).toBeNull();

    await repository.delete(COMPANY_ID, "req-1", OTHER_USER_ID);
    await repository.delete(COMPANY_ID, "req-1", OTHER_USER_ID);
    expect(
      await repository.findByRequisitionAndUser(COMPANY_ID, "req-1", OTHER_USER_ID),
    ).toBeNull();
  });
});

describe("FakeRequisitionNumberGenerator", () => {
  it("incrementa por empresa com contadores independentes", async () => {
    const generator = new FakeRequisitionNumberGenerator();
    expect(await generator.next(COMPANY_ID)).toBe(1);
    expect(await generator.next(COMPANY_ID)).toBe(2);
    expect(await generator.next(OTHER_COMPANY_ID)).toBe(1);
    expect(await generator.next(COMPANY_ID)).toBe(3);
  });
});
