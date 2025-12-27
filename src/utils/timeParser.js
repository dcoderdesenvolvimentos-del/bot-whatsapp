export function parseTime(text) {
  const now = new Date();

  if (text.includes("daqui a")) {
    const m = text.match(/daqui a (\d+) (minuto|minutos|hora|horas)/);
    if (m) {
      const val = parseInt(m[1]);
      const d = new Date(now);
      if (m[2].startsWith("min")) d.setMinutes(d.getMinutes() + val);
      else d.setHours(d.getHours() + val);
      return { text: text.replace(m[0], "").trim(), time: d };
    }
  }

  const h = text.match(/(\d{1,2}):(\d{2})/);
  if (h) {
    const d = new Date(now);
    d.setHours(+h[1], +h[2], 0, 0);
    return { text: text.replace(h[0], "").trim(), time: d };
  }

  return null;
}
