export function createTimestampBR({ offset_dias, hora, minuto }) {
  const now = new Date();

  // Cria a data/hora SEM fuso horário (local puro)
  const date = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + offset_dias,
    hora,
    minuto,
    0,
    0
  );

  // Compensa o offset do Brasil (-3h = -180 min)
  const offsetBR = 3 * 60 * 60 * 1000; // 3 horas em milissegundos

  return date.getTime() + offsetBR;
}

export function createDateBR() {
  const now = new Date();
  const [year, month, day] = now.toISOString().split("T")[0].split("-");
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
