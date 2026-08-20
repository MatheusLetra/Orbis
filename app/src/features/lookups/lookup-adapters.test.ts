import { describe, expect, it, vi } from "vitest";
import { chatClient } from "@/features/chat/chat-client";
import { membersClient } from "@/features/members/members-client";
import { requisitionsClient } from "@/features/requisitions/requisition-client";
import {
  createChatParticipantLookup,
  createMemberLookup,
  createRequisitionLookup,
} from "./lookup-adapters";

describe("lookup adapters", () => {
  it("consulta membros do tenant ativo e preserva AbortSignal", async () => {
    const signal = new AbortController().signal;
    const list = vi
      .spyOn(membersClient, "list")
      .mockResolvedValue([{ userId: "user-a", name: "Ana" }]);
    const lookup = createMemberLookup("company-a");

    await expect(lookup.search({ search: " ana " }, { signal })).resolves.toEqual({
      items: [{ id: "user-a", label: "Ana" }],
      nextCursor: null,
    });
    expect(list).toHaveBeenCalledWith("company-a", { search: " ana " }, { signal });
    expect(lookup.queryKey("ana")).toEqual([
      "lookup",
      "members",
      "company-a",
      "users.read",
      "ana",
      null,
    ]);
  });

  it("remove requisições canceladas e mantém somente registros do endpoint tenant-aware", async () => {
    const list = vi.spyOn(requisitionsClient, "list").mockResolvedValue([
      {
        id: "req-a",
        companyId: "company-a",
        number: 7,
        title: "Entrega",
        description: null,
        priority: "HIGH",
        status: "OPEN",
        requesterId: "user-a",
        responsibleId: null,
        systemId: null,
        systemVersionId: null,
        estimatedHours: null,
        startDate: null,
        plannedDeliveryDate: null,
        deliveredAt: null,
        createdAt: "2026-08-20T00:00:00.000Z",
        updatedAt: "2026-08-20T00:00:00.000Z",
      },
      {
        id: "req-cancelled",
        companyId: "company-a",
        number: 8,
        title: "Cancelada",
        description: null,
        priority: "LOW",
        status: "CANCELLED",
        requesterId: "user-a",
        responsibleId: null,
        systemId: null,
        systemVersionId: null,
        estimatedHours: null,
        startDate: null,
        plannedDeliveryDate: null,
        deliveredAt: null,
        createdAt: "2026-08-20T00:00:00.000Z",
        updatedAt: "2026-08-20T00:00:00.000Z",
      },
    ]);
    const lookup = createRequisitionLookup("company-a");

    await expect(
      lookup.search({ search: "entrega" }, { signal: new AbortController().signal }),
    ).resolves.toEqual({
      items: [{ id: "req-a", label: "#7 · Entrega", description: "OPEN" }],
      nextCursor: null,
    });
    expect(list).toHaveBeenCalledWith(
      "company-a",
      { search: "entrega" },
      { signal: expect.any(AbortSignal) },
    );
  });

  it("consulta participantes do Chat com chat.use e preserva AbortSignal", async () => {
    const signal = new AbortController().signal;
    const list = vi
      .spyOn(chatClient, "listParticipants")
      .mockResolvedValue([{ userId: "user-a", name: "Ana" }]);
    const lookup = createChatParticipantLookup("company-a");

    await expect(lookup.search({ search: " ana " }, { signal })).resolves.toEqual({
      items: [{ id: "user-a", label: "Ana" }],
      nextCursor: null,
    });
    expect(list).toHaveBeenCalledWith("company-a", " ana ", { signal });
    expect(lookup.capability).toBe("chat.use");
  });
});
