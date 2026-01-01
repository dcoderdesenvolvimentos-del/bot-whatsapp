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

  return null;
}
