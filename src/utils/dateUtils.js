export function createTimestampBR({ offset_dias = 0, hora, minuto }) {
  const now = new Date();

  const date = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + offset_dias,
    hora,
    minuto,
    0,
    0,
  );

  // ❗ NÃO mexe em timezone
  return date.getTime();
}

export function createDateBR() {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const year = now.getFullYear();

  return `${day}-${month}-${year}`;
}

export function formatDateToBR(isoDate) {
  const [year, month, day] = isoDate.split("-");
  return `${day}-${month}-${year}`;
}

export function createHourBR() {
  const now = new Date();
  return now.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Calculo pra saber qual dia do calendario é a proxima semana,
// exemplo: Terça dia 20
export function nextWeekdayBR(targetWeekday, hour = 0, minute = 0) {
  const now = new Date();

  const result = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    hour,
    minute,
    0,
    0,
  );

  const currentWeekday = result.getDay(); // 0–6
  let diff = targetWeekday - currentWeekday;

  // se já passou hoje, joga pra próxima semana
  if (diff < 0 || (diff === 0 && result <= now)) {
    diff += 7;
  }

  result.setDate(result.getDate() + diff);

  return result.getTime();
}

export function extractWeekdayFromText(text) {
  if (!text) return null;

  const map = {
    domingo: 0,
    segunda: 1,
    "segunda-feira": 1,
    terça: 2,
    "terça-feira": 2,
    terca: 2,
    quarta: 3,
    "quarta-feira": 3,
    quinta: 4,
    "quinta-feira": 4,
    sexta: 5,
    "sexta-feira": 5,
    sábado: 6,
    sabado: 6,
  };

  const lower = text.toLowerCase();

  for (const key in map) {
    if (lower.includes(key)) {
      return map[key];
    }
  }

  return null;
}
