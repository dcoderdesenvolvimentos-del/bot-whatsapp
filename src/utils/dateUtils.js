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
