import { describe, expect, it } from "vitest";
import { Entity } from "./entity";

class FakeEntity extends Entity<string> {}

class FakeNumberEntity extends Entity<number> {}

describe("Entity", () => {
  it("expõe o id", () => {
    expect(new FakeEntity("req-1").id).toBe("req-1");
    expect(new FakeNumberEntity(7).id).toBe(7);
  });

  it("é igual a outra entidade com o mesmo id", () => {
    const a = new FakeEntity("req-1");
    const b = new FakeEntity("req-1");

    expect(a.equals(b)).toBe(true);
  });

  it("não é igual a entidade com id diferente", () => {
    expect(new FakeEntity("req-1").equals(new FakeEntity("req-2"))).toBe(false);
  });
});
