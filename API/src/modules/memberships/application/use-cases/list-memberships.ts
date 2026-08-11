import type { UseCase } from "../../../../shared/application/use-case.js";
import type { MembershipRepository } from "../../domain/repositories/membership-repository.js";
import { type MembershipOutput, toMembershipOutput } from "../dto/membership-dtos.js";

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
