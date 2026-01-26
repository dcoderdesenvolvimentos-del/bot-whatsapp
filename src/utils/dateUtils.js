// ===============================
// 🔥 UTC CORE (lembretes)
// ===============================

// agora em UTC (timestamp)
export function nowUTC() {
  return Date.now();
}

// cria timestamp UTC a partir de data BR
export function createTimestampUTC({ offset_dias = 0, hora, minuto }) {
  const nowBR = new Date(
    new Date().toLocaleString("en-US", {
      timeZone: "America/Sao_Paulo",
    }),
  );

  const local = new Date(
    nowBR.getFullYear(),
    nowBR.getMonth(),
    nowBR.getDate() + offset_dias,
    hora,
    minuto,
    0,
    0,
  );

  return local.getTime();
}

// próximo dia da semana
// utils/dateUtils.js
export function nextWeekdayUTC(weekday, hour = 9, minute = 0) {
  const now = new Date();

  const currentDay = now.getDay(); // 0 (dom) a 6 (sáb)
  let diff = weekday - currentDay;

  // se for hoje mas a hora já passou, ou se já passou na semana
  if (diff < 0 || (diff === 0 && now.getHours() >= hour)) {
    diff += 7;
  }

  const result = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + diff,
    hour,
    minute,
    0,
    0,
  );

  return result; // 🔥 SEMPRE Date
}

// ===============================
// 🧾 LEGACY / GASTOS (NÃO REMOVER)
// ===============================

// data BR (DD-MM-YYYY)
export function createDateBR() {
  const now = new Date(
    new Date().toLocaleString("en-US", {
      timeZone: "America/Sao_Paulo",
    }),
  );

  const d = String(now.getDate()).padStart(2, "0");
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const y = now.getFullYear();

  return `${d}-${m}-${y}`;
}

// hora BR (HH:MM)
export function createHourBR() {
  return new Date(
    new Date().toLocaleString("en-US", {
      timeZone: "America/Sao_Paulo",
    }),
  ).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
