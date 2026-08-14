import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createQueryClient } from "@/lib/query/query-client";
import { membersClient } from "./members-client";
import { memberKeys } from "./members-keys";
import { useCompanyMembers } from "./members-queries";

function wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={createQueryClient()}>{children}</QueryClientProvider>;
}

describe("useCompanyMembers", () => {
  it("permanece idle e não chama o client sem empresa", () => {
    const list = vi.spyOn(membersClient, "list");
    const { result } = renderHook(() => useCompanyMembers(null, { search: "Ana" }), { wrapper });

    expect(result.current.fetchStatus).toBe("idle");
    expect(result.current.isPending).toBe(true);
    expect(list).not.toHaveBeenCalled();
  });

  it("consulta com filtros e signal na chave isolada da empresa", async () => {
    const response = [{ id: "member-a", name: "Ana" }];
    const list = vi.spyOn(membersClient, "list").mockResolvedValue(response as never);
    const client = createQueryClient();
    const { result } = renderHook(() => useCompanyMembers("company-a", { search: "  Ana  " }), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(list).toHaveBeenCalledWith(
      "company-a",
      { search: "  Ana  " },
      {
        signal: expect.any(AbortSignal),
      },
    );
    expect(client.getQueryData(memberKeys.list("company-a", { search: "Ana" }))).toBe(response);
    expect(client.getQueryData(memberKeys.list("company-b", { search: "Ana" }))).toBeUndefined();
  });
});
