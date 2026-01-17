export function parseReceiptText(text) {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  /* ==========================
     🔧 HELPERS
  ========================== */

  const normalizeText = (str) =>
    str
      .toUpperCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();

  const stripCompanySuffix = (name) =>
    name
      .replace(
        /\b(LTDA|ME|EPP|EIRELI|SA|S\/A|COMERCIAL|INDUSTRIA|SERVICOS)\b/g,
        "",
      )
      .replace(/\s{2,}/g, " ")
      .trim();

  /* ==========================
     💰 EXTRAIR VALOR TOTAL
  ========================== */

  let valor = null;

  // 🥇 PRIORIDADE: VALOR TOTAL / VALOR PAGO
  for (const line of lines) {
    const l = normalizeText(line);

    if (/VALOR\s*TOTAL|VALOR\s*PAGO|TOTAL\s*R\$|TOTAL\s*A\s*PAGAR/.test(l)) {
      const match = l.match(/(\d+[.,]\d{2})/);
      if (match) {
        valor = parseFloat(match[1].replace(",", "."));
        break;
      }
    }
  }

  // 🥈 FALLBACK: MAIOR VALOR MONETÁRIO REAL
  if (!valor) {
    const valores = [];

    for (const line of lines) {
      const l = normalizeText(line);

      // ❌ ignora identificadores institucionais
      if (/CNPJ|CPF|IE|INSCRICAO|CHAVE|CODIGO|PROTOCOLO|SERIE|NFC|ECF/.test(l))
        continue;

      // ❌ ignora números longos ou fracionados
      if (/\d{4,}/.test(l)) continue;
      if (/\//.test(l)) continue;

      const match = l.match(/\b(\d{1,3}[.,]\d{2})\b/);
      if (match) {
        valores.push(parseFloat(match[1].replace(",", ".")));
      }
    }

    if (valores.length) {
      valor = Math.max(...valores);
    }
  }

  /* ==========================
     🏪 NOME DO ESTABELECIMENTO
  ========================== */

  let local = null;
  let tipo = "outros";

  const blacklist = [
    "COMPROVANTE",
    "REIMPRESSAO",
    "DOCUMENTO",
    "AUXILIAR",
    "NOTA FISCAL",
    "CONSUMIDOR",
    "CNPJ",
    "CPF",
    "IE",
    "CODIGO",
    "DESCRICAO",
    "QTDE",
    "ITEM",
    "ITENS",
    "FORMA DE PAGAMENTO",
    "MA DE PAGAMENTO", // OCR quebrado
    "PAGAMENTO",
    "VALOR",
    "TOTAL",
    "VALOR PAGO",
    "AUTORIZACAO",
    "PROTOCOLO",
    "OPERADOR",
    "DATA",
    "HORA",
    "SERIE",
    "NFC",
    "ECF",
    "TRIBUTOS",
    "IMPOSTO",
    "LEI",
  ];

  // 🔎 só analisa linhas ANTES do CNPJ
  const indexCnpj = lines.findIndex((l) => normalizeText(l).includes("CNPJ"));

  const candidateLines = indexCnpj > 0 ? lines.slice(0, indexCnpj) : lines;

  for (const line of candidateLines) {
    const l = normalizeText(line);

    if (blacklist.some((w) => l.includes(w))) continue;
    if (l.length < 6) continue;
    if (/\d/.test(l)) continue;

    if (/^[A-Z\s&.-]+$/.test(l)) {
      local = stripCompanySuffix(l);

      // 🔎 tipo do estabelecimento
      if (/POSTO|COMBUSTIVEL|GASOLINA|ETANOL|DIESEL/.test(l)) tipo = "posto";
      else if (/FARMACIA|DROGARIA/.test(l)) tipo = "farmacia";
      else if (/SUPERMERCADO|MERCADO|ATACAD|HIPER/.test(l)) tipo = "mercado";
      else if (
        /PIZZA|LANCH|BURGER|RESTAURANTE|IFOOD|DELIVERY|BAR|LANCHONETE/.test(l)
      )
        tipo = "delivery";

      break;
    }
  }

  /* ==========================
     📦 RESULTADO FINAL
  ========================== */

  return {
    valor: valor || null,
    local: local || "Local não identificado",
    tipo,
  };
}
