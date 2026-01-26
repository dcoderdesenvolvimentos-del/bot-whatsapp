export function parseBRL(value) {
  if (!value) return null;

  // aceita número direto
  if (typeof value === "number") return value;

  let str = value.toString();

  // remove R$, espaços etc
  str = str.replace(/[^\d,.-]/g, "");

  // se tiver vírgula, ela é decimal
  if (str.includes(",")) {
    str = str.replace(/\./g, ""); // remove separador de milhar
    str = str.replace(",", "."); // vírgula vira decimal
  }

  const parsed = parseFloat(str);
  return isNaN(parsed) ? null : parsed;
}
