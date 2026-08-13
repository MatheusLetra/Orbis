import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createQueryClient } from "@/lib/query/query-client";
import { attachmentsClient } from "./attachment-client";
import type { AttachmentOutput } from "./attachment-contracts";
import { useTaskAttachments } from "./attachment-queries";

const attachment: AttachmentOutput = {
  id: "attachment-a",
  companyId: "company-a",
  owner: { type: "TASK", taskId: "task-a" },
  kind: "LINK",
  title: "Docs",
  fileName: null,
  mimeType: null,
  checksum: null,
  sizeBytes: null,
  url: "https://example.com",
  createdBy: "user-a",
  createdAt: "2026-01-01T00:00:00.000Z",
};

function Probe({
  companyId,
  taskId,
  enabled,
}: {
  companyId: string | null;
  taskId: string | null;
  enabled: boolean;
}) {
  const query = useTaskAttachments(companyId, taskId, enabled);
  return <span>{query.isFetching ? "fetching" : (query.data?.[0]?.title ?? "idle")}</span>;
}

describe("attachment query", () => {
  it.each([
    [null, "task-a", true],
    ["company-a", null, true],
    ["company-a", "task-a", false],
  ] as const)(
    "fica desabilitada para company=%s task=%s enabled=%s",
    (companyId, taskId, enabled) => {
      const list = vi.spyOn(attachmentsClient, "listForTask");
      render(
        <QueryClientProvider client={createQueryClient()}>
          <Probe companyId={companyId} taskId={taskId} enabled={enabled} />
        </QueryClientProvider>,
      );
      expect(list).not.toHaveBeenCalled();
    },
  );

  it("carrega somente após enabled e mantém respostas tenant-aware", async () => {
    const list = vi.spyOn(attachmentsClient, "listForTask").mockResolvedValue([attachment]);
    render(
      <QueryClientProvider client={createQueryClient()}>
        <Probe companyId="company-a" taskId="task-a" enabled />
      </QueryClientProvider>,
    );
    expect(await screen.findByText("Docs")).toBeInTheDocument();
    expect(list).toHaveBeenCalledWith(
      "company-a",
      "task-a",
      expect.objectContaining({ signal: expect.anything() }),
    );
  });
});
