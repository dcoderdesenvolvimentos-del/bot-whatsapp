const blacklist = [
  // fiscais / administrativas
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

  // pagamento (❗ ESSENCIAL)

  "FORMA DE PAGAMENTO",
  "MA DE PAGAMENTO",
  "PAGAMENTO",
  "CARTAO",
  "CREDITO",
  "DEBITO",
  "PIX",
  "DINHEIRO",
  "TRANSFERENCIA",
  "TAO DE CREDITO",
  "CONSULTE",
  "CHAVE",
  "CHAVE DE ACESSO",
  "CONSULTE PELA CHAVE",
  "PORTAL",
  "PORTAL NFC",
  "PORTAL NFCE",
  "FAZENDA",
  "SEFAZ",
  "GOV",
  "HTTP",
  "HTTPS",
  "WWW",
  "URL",
  // OCR quebrado
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
      data = y.length === 2 ? `-${d}/${m}/20${y}` : `${d}/${m}/${y}`;
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
        if (
          /SUPERMERCADO|MERCADO|ATACAD|HIPER|HORTIFRUTI|HORTI/.test(cleaned)
        ) {
          tipo = "mercado";
        } else if (
          /FARMACIA|DROGARIA|DROGASIL|DROGA|PACHECO|RAIA/.test(cleaned)
        ) {
          tipo = "farmacia";
        } else if (
          /POSTO|COMBUSTIVEL|GASOLINA|ETANOL|DIESEL|SHELL|IPIRANGA|BR/.test(
            cleaned,
          )
        ) {
          tipo = "posto";
        } else if (
          /RESTAURANTE|LANCH|LANCHE|PIZZA|BAR|HAMBURGUER|BURGER|CHURRASC|ESPET|FOOD/.test(
            cleaned,
          )
        ) {
          tipo = "alimentacao";
        } else if (/PADARIA|PANIFICAD|PAO|CONFEITARIA/.test(cleaned)) {
          tipo = "padaria";
        } else if (/UBER|99|TAXI|TRANSPORTE|ONIBUS|METRO|TREM/.test(cleaned)) {
          tipo = "transporte";
        } else if (/ALUGUEL|IMOBILIARIA|CONDOMINIO/.test(cleaned)) {
          tipo = "moradia";
        } else if (/LUZ|ENERGIA|ELETRIC|ENEL|CPFL|ELETROPAULO/.test(cleaned)) {
          tipo = "energia";
        } else if (/AGUA|SABESP|SANEPAR|CAESB/.test(cleaned)) {
          tipo = "agua";
        } else if (/INTERNET|NET|CLARO|VIVO|TIM|OI|TELECOM/.test(cleaned)) {
          tipo = "internet";
        } else if (
          /ESCOLA|FACULDADE|CURSO|EDUCACAO|ENSINO|COLEGIO/.test(cleaned)
        ) {
          tipo = "educacao";
        } else if (/ACADEMIA|GYM|FITNESS|PERSONAL/.test(cleaned)) {
          tipo = "academia";
        } else if (
          /MEDICO|CLINICA|HOSPITAL|EXAME|CONSULTA|ODONTO|DENTISTA/.test(cleaned)
        ) {
          tipo = "saude";
        } else if (/ROUPA|VESTUARIO|CALCADO|SAPATO|TENIS|MODA/.test(cleaned)) {
          tipo = "vestuario";
        } else if (
          /SHOPPING|LOJA|MAGAZINE|CASAS|AMERICANAS|HAVAN/.test(cleaned)
        ) {
          tipo = "compras";
        } else if (/CINEMA|TEATRO|SHOW|EVENTO|INGRESSO/.test(cleaned)) {
          tipo = "lazer";
        } else if (
          /STREAMING|NETFLIX|SPOTIFY|AMAZON|PRIME|DISNEY/.test(cleaned)
        ) {
          tipo = "assinatura";
        } else if (/BANCO|TARIFA|IOF|JUROS|ANUIDADE/.test(cleaned)) {
          tipo = "banco";
        } else if (/PET|VETERINARIO|PETSHOP|RACAO/.test(cleaned)) {
          tipo = "pet";
        } else if (/OFICINA|MANUTENCAO|AUTO|MECANICA|LAVAGEM/.test(cleaned)) {
          tipo = "veiculo";
        } else if (/DOACAO|IGREJA|OFERTA|DIZIMO/.test(cleaned)) {
          tipo = "doacao";
        } else {
          tipo = "Outros";
        }

        break;
      }
    }
  }

  /* 🥈 FALLBACK: heurística antiga */
  if (!local) {
    for (const line of lines) {
      const l = normalizeText(line);

      if (!isValidCompanyName(l)) continue;

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
