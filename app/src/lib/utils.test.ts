import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("combina classes", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("mescla classes de tailwind-merge", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });

  it("filtra valores falsy", () => {
    expect(cn("a", false, undefined, null, "b")).toBe("a b");
  });
});
