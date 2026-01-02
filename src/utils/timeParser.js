const DAYS = {
  domingo: 0,
  segunda: 1,
  terça: 2,
  terca: 2,
  quarta: 3,
  quinta: 4,
  sexta: 5,
  sábado: 6,
  sabado: 6,
};

export function parseTime(text) {
  const now = new Date();
  const lower = text.toLowerCase();

  // ======================
  // ⏱️ DAQUI X MINUTOS / HORAS
  // ======================
  let match = lower.match(/daqui\s+(\d+)\s+(minuto|minutos|hora|horas)/);
  if (match) {
    const value = Number(match[1]);
    const unit = match[2].startsWith("hora") ? 60 : 1;
    return now.getTime() + value * unit * 60000;
  }

  // ======================
  // 🕐 HOJE / AMANHÃ / DEPOIS DE AMANHÃ
  // ======================
  if (
    lower.includes("hoje") ||
    lower.includes("amanhã") ||
    lower.includes("depois de amanhã")
  ) {
    let days = 0;
    if (lower.includes("amanhã")) days = 1;
    if (lower.includes("depois de amanhã")) days = 2;

    const hourMatch = lower.match(/(\d{1,2})(?:[:h ](\d{1,2}))?/);
    const hour = hourMatch ? Number(hourMatch[1]) : 9;
    const minute = hourMatch && hourMatch[2] ? Number(hourMatch[2]) : 0;

    const date = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + days,
      hour,
      minute,
      0,
      0
    );

    return date.getTime();
  }

  // ======================
  // 📅 PRÓXIMA SEMANA (quarta, quinta…)
  // ======================
  match = lower.match(
    /(próxima|proxima)?\s*(domingo|segunda|terça|terca|quarta|quinta|sexta|sábado|sabado)/
  );
  if (match) {
    const targetDay = DAYS[match[2]];
    let diff = targetDay - now.getDay();
    if (diff <= 0) diff += 7;

    const hourMatch = lower.match(/(\d{1,2})(?:[:h ](\d{1,2}))?/);
    const hour = hourMatch ? Number(hourMatch[1]) : 9;
    const minute = hourMatch && hourMatch[2] ? Number(hourMatch[2]) : 0;

    const date = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + diff,
      hour,
      minute,
      0,
      0
    );

    return date.getTime();
  }

  // ======================
  // 🗓️ DIA X (ex: dia 2 às 10)
  // ======================
  match = lower.match(/dia\s+(\d{1,2})(?:.*?(\d{1,2})(?:[:h ](\d{1,2}))?)?/);
  if (match) {
    const day = Number(match[1]);
    const hour = match[2] ? Number(match[2]) : 9;
    const minute = match[3] ? Number(match[3]) : 0;

    const date = new Date(
      now.getFullYear(),
      now.getMonth(),
      day,
      hour,
      minute,
      0,
      0
    );

    return date.getTime();
  }

  // src/utils/timeParser.js

  /**
   * Constrói uma data baseada em dias + hora/minuto
   */
  function buildDate(daysToAdd, hour = 9, minute = 0) {
    const now = new Date();

    return new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + daysToAdd,
      hour,
      minute,
      0,
      0
    ).getTime();
  }

  /**
   * Extrai timestamp a partir de texto livre em PT-BR
   * Retorna number (timestamp) ou null
   */

  // =========================
  // 1️⃣ DAQUI X MINUTOS / HORAS (PRIORIDADE MÁXIMA)
  // =========================
  const relativeMatch = lower.match(
    /daqui\s+(\d+)\s*(minuto|minutos|hora|horas)/i
  );

  if (relativeMatch) {
    const value = Number(relativeMatch[1]);
    const unit = relativeMatch[2];

    let ms = value * 60000; // minutos
    if (unit.startsWith("hora")) ms = value * 60 * 60000;

    return Date.now() + ms;
  }

  // =========================
  // Extrair hora/minuto (se existir)
  // =========================
  const hourMatch = lower.match(/(\d{1,2})(?:[:h ](\d{1,2}))?/);
  const hour = hourMatch ? Number(hourMatch[1]) : 9;
  const minute = hourMatch?.[2] ? Number(hourMatch[2]) : 0;

  // =========================
  // 2️⃣ HOJE
  // =========================
  if (lower.includes("hoje")) {
    return buildDate(0, hour, minute);
  }

  // =========================
  // 3️⃣ AMANHÃ
  // =========================
  if (lower.includes("amanhã")) {
    return buildDate(1, hour, minute);
  }

  // =========================
  // 4️⃣ DEPOIS DE AMANHÃ
  // =========================
  if (lower.includes("depois de amanhã")) {
    return buildDate(2, hour, minute);
  }

  // =========================
  // 5️⃣ DIAS DA SEMANA
  // =========================
  const weekdays = {
    domingo: 0,
    segunda: 1,
    terça: 2,
    terca: 2,
    quarta: 3,
    quinta: 4,
    sexta: 5,
    sábado: 6,
    sabado: 6,
  };

  for (const [day, index] of Object.entries(weekdays)) {
    if (lower.includes(day)) {
      const now = new Date();
      let diff = index - now.getDay();
      if (diff <= 0) diff += 7;

      return buildDate(diff, hour, minute);
    }
  }

  // =========================
  // ❌ Não encontrou data
  // =========================
  return null;
}
