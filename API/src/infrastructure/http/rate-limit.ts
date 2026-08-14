import type { FastifyRequest } from "fastify";
import { TooManyRequestsError } from "@/shared/errors/typed-errors";

interface Bucket {
  count: number;
  resetAt: number;
}

export function createRateLimitHook(max: number, windowMs: number) {
  const buckets = new Map<string, Bucket>();
  return async function rateLimit(request: FastifyRequest): Promise<void> {
    const key = request.ip;
    const now = Date.now();
    const current = buckets.get(key);
    if (!current || current.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return;
    }
    current.count += 1;
    if (current.count > max)
      throw new TooManyRequestsError("Muitas tentativas. Tente novamente mais tarde.");
  };
}
