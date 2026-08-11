import { ValueObject } from "@/shared/domain/value-object";

const MAX_LENGTH = 50;

export class Position extends ValueObject<string> {
  constructor(value: string) {
    const position = value.trim();

    if (position.length === 0) {
      throw new Error("Cargo não pode ser vazio");
    }

    if (position.length > MAX_LENGTH) {
      throw new Error(`Cargo não pode exceder ${MAX_LENGTH} caracteres`);
    }

    super(position);
  }
}
