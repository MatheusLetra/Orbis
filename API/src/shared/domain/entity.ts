export abstract class Entity<TId extends string | number> {
  readonly id: TId;

  constructor(id: TId) {
    this.id = id;
  }

  equals(other: Entity<TId>): boolean {
    return this.id === other.id;
  }
}
