export function normalizeMoney(value) {
  if (value === null || value === undefined) return null;

  // se já for número válido
  if (typeof value === "number" && !isNaN(value)) {
    return value;
  }

  if (typeof value !== "string") return null;

  let v = value
    .toLowerCase()
    .replace(/[^\d,.-]/g, "") // remove letras e símbolos
    .replace(/\.(?=\d{3})/g, "") // remove ponto de milhar
    .replace(",", "."); // vírgula vira decimal

  const n = Number(v);
  if (isNaN(n)) return null;

  return n;
}
