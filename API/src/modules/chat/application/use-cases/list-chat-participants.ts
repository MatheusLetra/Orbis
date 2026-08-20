import type { ChatAuthorizationService } from "@/modules/chat/application/services/chat-authorization-service";
import type { CompanyMemberLookupRepository } from "@/modules/memberships/domain/repositories/company-member-lookup-repository";
import type { AuthenticatedUser } from "@/shared/application/authenticated-user";

export class ListChatParticipants {
  constructor(
    private readonly members: CompanyMemberLookupRepository,
    private readonly access: ChatAuthorizationService,
  ) {}

  async execute(input: { actor: AuthenticatedUser; search?: string }) {
    await this.access.assertActor(input.actor);
    return this.members.listActiveByCompany(input.actor.companyId, input.search, 50);
  }
}
