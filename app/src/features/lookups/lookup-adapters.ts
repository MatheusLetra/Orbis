import type { LookupDefinition } from "@/components/common/id-lookup-field";
import { chatClient } from "@/features/chat/chat-client";
import { membersClient } from "@/features/members/members-client";
import { requisitionsClient } from "@/features/requisitions/requisition-client";

export function createMemberLookup(companyId: string): LookupDefinition {
  return {
    entity: "member",
    companyId,
    capability: "users.read",
    queryKey: (search) => ["lookup", "members", companyId, "users.read", search, null],
    search: async ({ search }, options) => ({
      items: (await membersClient.list(companyId, { search }, options)).map((member) => ({
        id: member.userId,
        label: member.name,
      })),
      nextCursor: null,
    }),
  };
}

export function createRequisitionLookup(companyId: string): LookupDefinition {
  return {
    entity: "requisition",
    companyId,
    capability: "requisitions.read",
    queryKey: (search) => ["lookup", "requisitions", companyId, "requisitions.read", search, null],
    search: async ({ search }, options) => ({
      items: (await requisitionsClient.list(companyId, { search }, options))
        .filter((item) => item.status !== "CANCELLED")
        .map((item) => ({
          id: item.id,
          label: `#${item.number} · ${item.title}`,
          description: item.status,
        })),
      nextCursor: null,
    }),
  };
}

export function createChatParticipantLookup(companyId: string): LookupDefinition {
  return {
    entity: "chat-participant",
    companyId,
    capability: "chat.use",
    queryKey: (search) => ["lookup", "chat-participants", companyId, "chat.use", search, null],
    search: async ({ search }, options) => ({
      items: (await chatClient.listParticipants(companyId, search, options)).map((participant) => ({
        id: participant.userId,
        label: participant.name,
      })),
      nextCursor: null,
    }),
  };
}
