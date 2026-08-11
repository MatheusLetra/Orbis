const UNIT_MULTIPLIERS: Record<string, number> = {
  ms: 1,
  s: 1000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

export function parseTtlToMs(ttl: string): number {
  const match = /^(\d+)(ms|s|m|h|d)$/.exec(ttl.trim());
  if (!match) {
    throw new Error(`TTL inválido: "${ttl}"`);
  }
  const unit = match[2];
  const multiplier = unit === undefined ? undefined : UNIT_MULTIPLIERS[unit];
  if (multiplier === undefined) {
    throw new Error(`TTL inválido: "${ttl}"`);
  }
  return Number(match[1]) * multiplier;
}
