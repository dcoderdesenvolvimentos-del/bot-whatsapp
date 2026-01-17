export function createTimestampBR({ offset_dias = 0, hora, minuto }) {
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
