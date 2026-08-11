export abstract class ValueObject<TValue> {
  protected readonly value: TValue;

  constructor(value: TValue) {
    this.value = value;
  }

  get(): TValue {
    return this.value;
  }

  equals(other: ValueObject<TValue>): boolean {
    if (other === undefined || other === null) {
      return false;
    }

    if (typeof this.value === "object" || typeof other.value === "object") {
      return JSON.stringify(this.value) === JSON.stringify(other.value);
    }

    return this.value === other.value;
  }

  toString(): string {
    return String(this.value);
  }
}
