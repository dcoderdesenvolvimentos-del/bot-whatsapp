export function createTimestampBR({ offset_dias, hora, minuto }) {
  const now = new Date();

  const date = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + offset_dias,
    hora,
    minuto,
    0,
    0
  );

  return date.getTime();
}

export function createDateBR() {
  const now = new Date();
  return now.toISOString().split("T")[0]; // YYYY-MM-DD
}

export function createHourBR() {
  const now = new Date();
  return now.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
