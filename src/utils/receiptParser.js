const blacklist = [
  // ===============================
  // FISCAL / ADMINISTRATIVO
  // ===============================
  "COMPROVANTE",
  "REIMPRESSAO",
  "REIMPRESSAO DO COMPROVANTE",
  "DOCUMENTO",
  "DOCUMENTO AUXILIAR",
  "AUXILIAR",
  "NOTA FISCAL",
  "NOTA FISCAL DE CONSUMIDOR",
  "NFC",
  "NFCE",
  "NFC-E",
  "ECF",
  "SAT",
  "CF-E",
  "CUPOM",
  "CUPOM FISCAL",
  "CONSUMIDOR",
  "FINAL",
  "CNPJ",
  "CPF",
  "IE",
  "IM",
  "INSCRICAO",
  "INSCRICAO ESTADUAL",
  "INSCRICAO MUNICIPAL",
  "CODIGO",
  "COD",
  "CODIGO ITEM",
  "DESCRICAO",
  "DESC",
  "QTDE",
  "QTD",
  "QUANTIDADE",
  "ITEM",
  "ITENS",
  "UN",
  "UNIDADE",
  "VALOR",
  "VALOR UNIT",
  "VALOR UNITARIO",
  "SUBTOTAL",
  "TOTAL",
  "VALOR TOTAL",
  "VALOR PAGO",
  "TROCO",
  "DESCONTO",
  "ACRESCIMO",
  "TRIBUTOS",
  "IMPOSTO",
  "IMPOSTOS",
  "ICMS",
  "ISS",
  "IPI",
  "PIS",
  "COFINS",
  "LEI",
  "LEI FEDERAL",
  "LEI FEDERAL 12741",

  // ===============================
  // DATA / CONTROLE
  // ===============================
  "DATA",
  "HORA",
  "EMISSAO",
  "EMITIDO EM",
  "AUTORIZACAO",
  "AUTORIZADO",
  "PROTOCOLO",
  "NSU",
  "N SU",
  "NSU HOST",
  "NSU TEF",
  "TERMINAL",
  "CAIXA",
  "OPERADOR",
  "OPER",
  "LOJA",
  "FILIAL",
  "PDV",
  "NUMERO",
  "NUM",
  "SERIE",

  // ===============================
  // PAGAMENTO (CRÍTICO)
  // ===============================
  "FORMA DE PAGAMENTO",
  "FORMA PAGAMENTO",
  "PAGAMENTO",
  "PGTO",
  "CARTAO",
  "CARTAO CREDITO",
  "CARTAO DE CREDITO",
  "CARTAO DEBITO",
  "DEBITO",
  "CREDITO",
  "PIX",
  "DINHEIRO",
  "TRANSFERENCIA",
  "TRANSF",
  "APROVADO",
  "NEGADO",
  "CONFIRMADO",
  "PARCELADO",
  "PARCELAS",
  "PARC",
  "VENCIMENTO",
  "BANDEIRA",
  "VISA",
  "MASTERCARD",
  "ELO",
  "AMEX",
  "HIPERCARD",
  "CABAL",

  // ===============================
  // MAQUINETAS / ADQUIRENTES (BRASIL)
  // ===============================
  "CIELO",
  "REDE",
  "GETNET",
  "STONE",
  "PAGSEGURO",
  "MERCADOPAGO",
  "MERCADO PAGO",
  "SUMUP",
  "SAFRA PAY",
  "SIPAG",
  "BIN",
  "ADYEN",
  "PAGARME",
  "PAGAR ME",
  "VINDI",
  "ZOOP",
  "TON",
  "TON T1",
  "TON T2",
  "TON T3",
  "INFINITEPAY",
  "INFINITE PAY",
  "YAPAY",
  "PAYGO",
  "PAY GO",
  "TEF",
  "TEF DEDICADO",
  "TEF DISCADO",
  "ELGIN",
  "GERTEC",
  "VERIFONE",
  "INGENICO",

  // ===============================
  // BANCOS / INSTITUIÇÕES
  // ===============================
  "BANCO",
  "ITAU",
  "BRADESCO",
  "SANTANDER",
  "CAIXA",
  "BB",
  "BANCO DO BRASIL",
  "NUBANK",
  "INTER",
  "C6",
  "PICPAY",
  "PICPAY PRO",
  "MERCADO PAGO",
  "PAGBANK",
  "WILL BANK",

  // ===============================
  // INTERNET / LINKS / CONSULTAS
  // ===============================
  "CONSULTE",
  "CONSULTE PELA CHAVE",
  "CHAVE",
  "CHAVE DE ACESSO",
  "PORTAL",
  "PORTAL NFC",
  "PORTAL NFCE",
  "SEFAZ",
  "FAZENDA",
  "GOV",
  "HTTP",
  "HTTPS",
  "WWW",
  "URL",
  "QRCODE",
  "QR CODE",

  // ===============================
  // OCR QUEBRADO / LIXO COMUM
  // ===============================
  "====",
  "****",
  "---",
  "...",
  "###",
  "@@@",
  "///",
  "\\\\",
  "|",
  "_",
  "º",
  "ª",
];

function isValidCompanyName(line, blacklist) {
  if (!line) return false;

  const l = line;

  if (blacklist.some((w) => l.includes(w))) return false;
  if (l.length < 6) return false;
  if (/\d/.test(l)) return false;
  if (!/^[A-Z\s&.-]+$/.test(l)) return false;

  // ❌ frases administrativas
  if (
    l.startsWith("CONSULTE") ||
    l.startsWith("ACESSE") ||
    l.startsWith("VERIFIQUE") ||
    l.startsWith("INFORME")
  )
    return false;

  return true;
}

export function parseReceiptText(text) {
  let valor = null;
  let local = null;
  let tipo = "outros";
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
  const indexCnpj = lines.findIndex((l) => normalizeText(l).includes("CNPJ"));

  const candidateLines = indexCnpj > 0 ? lines.slice(0, indexCnpj) : lines;

  const normalizedLines = lines.map(normalizeText);

  // 🔴 TENTATIVA A: primeira linha válida do cupom
  for (const l of normalizedLines.slice(0, 5)) {
    if (isValidCompanyName(l, blacklist)) {
      local = stripCompanySuffix(l);
      break;
    }
  }

  if (!local && indexCnpj > 0) {
    const candidate = normalizeText(lines[indexCnpj - 1]);
    if (isValidCompanyName(candidate, blacklist)) {
      local = stripCompanySuffix(candidate);
    }
  }

  /* ==========================
     📅 DATA E ⏰ HORA
  ========================== */

  let data = null;
  let hora = null;

  // DATA: DD/MM/YY ou DD/MM/YYYY
  for (const line of lines) {
    const match = line.match(/\b(\d{2}\/\d{2}\/\d{2,4})\b/);
    if (match) {
      const [d, m, y] = match[1].split("/");
      data = y.length === 2 ? `${d}/${m}/20${y}` : `${d}/${m}/${y}`;
      break;
    }
  }

  // HORA: HH:MM
  for (const line of lines) {
    const match = line.match(/\b(\d{2}:\d{2})\b/);
    if (match) {
      hora = match[1];
      break;
    }
  }

  // 🔎 só analisa linhas ANTES do CNPJ

  /* 🥇 PRIORIDADE: LINHA DO CNPJ */
  for (const line of lines) {
    const l = normalizeText(line);

    if (l.includes("CNPJ")) {
      // remove tudo antes do CNPJ
      const afterCnpj = l.split("CNPJ").pop();

      // remove números, símbolos e lixo
      const cleaned = afterCnpj
        .replace(/[:.\d\/\-]/g, " ")
        .replace(/\s{2,}/g, " ")
        .trim();

      if (cleaned.length >= 6) {
        local = stripCompanySuffix(cleaned);

        // classificação básica
        if (/SUPERMERCADO|MERCADO|ATACAD/.test(cleaned)) tipo = "mercado";
        else if (/FARMACIA|DROGARIA/.test(cleaned)) tipo = "farmacia";
        else if (/POSTO|COMBUSTIVEL/.test(cleaned)) tipo = "posto";
        else if (/RESTAURANTE|LANCH|PIZZA|BAR/.test(cleaned))
          tipo = "alimentacao";
        else if (/PADARIA|PANIFICAD|PAO|CONFEITARIA/.test(cleaned))
          tipo = "padaria";
        break;
      }
    }
  }

  /* 🥈 FALLBACK: heurística antiga */
  if (!local) {
    for (const line of lines) {
      const l = normalizeText(line);

      if (!isValidCompanyName(l, blacklist)) continue;

      local = stripCompanySuffix(l);
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
    data,
    hora,
  };
}
