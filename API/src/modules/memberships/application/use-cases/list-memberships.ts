import {
  type MembershipOutput,
  toMembershipOutput,
} from "@/modules/memberships/application/dto/membership-dtos";
import type { MembershipRepository } from "@/modules/memberships/domain/repositories/membership-repository";
import type { UseCase } from "@/shared/application/use-case";

export interface ListMembershipsInput {
  userId: string;
}

export class ListMemberships implements UseCase<ListMembershipsInput, MembershipOutput[]> {
  constructor(private readonly membershipRepository: MembershipRepository) {}

  async execute(input: ListMembershipsInput): Promise<MembershipOutput[]> {
    const memberships = await this.membershipRepository.listByUser(input.userId);

    return memberships.map(toMembershipOutput);
  }
}
