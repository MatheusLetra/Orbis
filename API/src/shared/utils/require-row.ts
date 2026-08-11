export function requireRow<T>(row: T | undefined, message = "Registro não encontrado"): T {
  if (row === undefined) {
    throw new Error(message);
  }
  return row;
}
