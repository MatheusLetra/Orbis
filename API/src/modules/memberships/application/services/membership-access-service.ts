import { ForbiddenError } from "../../../../shared/errors/typed-errors.js";
import type { MembershipRepository } from "../../domain/repositories/membership-repository.js";

export class MembershipAccessService {
  constructor(private readonly membershipRepository: MembershipRepository) {}

  async assertAccess(userId: string, companyId: string): Promise<void> {
    const membership = await this.membershipRepository.findByUserAndCompany(userId, companyId);

    if (!membership?.isActive) {
      throw new ForbiddenError("Usuário não possui acesso a esta empresa");
    }
  }
}
