export function parseReceiptText(text) {
  const cleanText = text.replace(/\n+/g, " ").toUpperCase();

  // 💰 VALOR
  const valorMatch = cleanText.match(/R\$?\s?(\d{1,3}(?:\.\d{3})*,\d{2})/);

  // 📅 DATA (09/12/25 ou 09/12/2025)
  const dataMatch = cleanText.match(/\b(\d{2}\/\d{2}\/\d{2,4})\b/);

  // ⏰ HORÁRIO (17:38 ou 17:38:22)
  const horaMatch = cleanText.match(/\b(\d{2}:\d{2})(?::\d{2})?\b/);

  // 📍 LOCAL (heurística simples)
  const localMatch = cleanText.match(
    /(EMPORIO|SUPERMERCADO|LTDA|ME|EIRELI|COMERCIO|PNEUS|MERCADO)[A-Z\s]{0,40}/
  );

  return {
    valor: valorMatch
      ? parseFloat(valorMatch[1].replace(/\./g, "").replace(",", "."))
      : null,

    data: dataMatch ? dataMatch[1] : null,

    hora: horaMatch ? horaMatch[1] : null,

    local: localMatch ? localMatch[0].trim() : "Comprovante",
  };
}
