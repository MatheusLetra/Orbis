import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { QueryCacheLifecycle } from "./query-cache-lifecycle";

const authState = { status: "authenticated" as "authenticated" | "unauthenticated" };
vi.mock("@/features/auth/auth-provider", () => ({ useAuth: () => authState }));

function Probe() {
  const client = useQueryClient();
  return <span>{client.getQueryData(["private"]) ? "cached" : "empty"}</span>;
}

describe("QueryCacheLifecycle", () => {
  it("limpa cache ao ficar unauthenticated", async () => {
    const { createQueryClient } = await import("./query-client");
    const client = createQueryClient();
    client.setQueryData(["private"], { value: "secret" });
    const view = render(
      <QueryClientProvider client={client}>
        <QueryCacheLifecycle />
        <Probe />
      </QueryClientProvider>,
    );
    expect(screen.getByText("cached")).toBeInTheDocument();
    authState.status = "unauthenticated";
    view.rerender(
      <QueryClientProvider client={client}>
        <QueryCacheLifecycle />
        <Probe />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(client.getQueryData(["private"])).toBeUndefined());
  });
});
