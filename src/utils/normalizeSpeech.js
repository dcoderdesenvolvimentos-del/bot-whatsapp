const numberMap = {
  zero: 0,
  um: 1,
  uma: 1,
  dois: 2,
  duas: 2,
  três: 3,
  tres: 3,
  quatro: 4,
  cinco: 5,
  seis: 6,
  sete: 7,
  oito: 8,
  nove: 9,
  dez: 10,
  onze: 11,
  doze: 12,
};

export function normalizeSpeech(text) {
  if (!text) return "";

  let t = text
    .toLowerCase()
    .replace(/[.,!?]/g, "")
    .replace(/\bmário\b/g, "")
    .replace(/\bmar\b/g, "")
    .replace(/\bme lembre\b/g, "me lembra")
    .replace(/\bpra\b/g, "para")
    .replace(/\bpor gentileza\b/g, "")
    .replace(/\bpor favor\b/g, "")
    .replace(/\s+/g, " ")
    .trim();

  // 🔢 converte números por extenso
  for (const [word, number] of Object.entries(numberMap)) {
    const regex = new RegExp(`\\b${word}\\b`, "g");
    t = t.replace(regex, number);
  }

  // 🔁 reordena frases do tipo:
  // "me lembra daqui 2 minutos de tomar água"
  const match = t.match(/me lembra daqui (.+?) de (.+)/);
  if (match) {
    const tempo = match[1];
    const acao = match[2];
    t = `me lembra de ${acao} daqui ${tempo}`;
  }

  return t;
}

export function normalizeText(text) {
  if (!text) return null;

  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}
