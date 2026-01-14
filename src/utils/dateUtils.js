export function createTimestampBR({ offset_dias, hora, minuto }) {
  // 🇧🇷 Pega a data/hora atual NO BRASIL
  const nowBR = new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })
  );

  // 🔹 Cria a data alvo NO BRASIL
  const targetBR = new Date(
    nowBR.getFullYear(),
    nowBR.getMonth(),
    nowBR.getDate() + offset_dias,
    hora,
    minuto,
    0,
    0
  );

  return targetBR.getTime();
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
