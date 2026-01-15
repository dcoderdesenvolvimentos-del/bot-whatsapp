import { db } from "../firebase.js";

function startOfDay(dateStr) {
  return new Date(dateStr + "T00:00:00").getTime();
}

function endOfDay(dateStr) {
  return new Date(dateStr + "T23:59:59").getTime();
}

export async function listarCompromissosPorPeriodo({
  userId,
  periodo,
  userName,
}) {
  if (!periodo?.data_inicio || !periodo?.data_fim) {
    return "⚠️ Não consegui identificar o período dos compromissos.";
  }

  const start = startOfDay(periodo.data_inicio);
  const end = endOfDay(periodo.data_fim);

  const snapshot = await db
    .collection("reminders")
    .where("phone", "==", userId)
    .where("when", ">=", start)
    .where("when", "<=", end)
    .orderBy("when", "asc")
    .get();

  if (snapshot.empty) {
    return "📭 Você não tem compromissos nesse período.";
  }

  const nome = userName ? ` ${userName}` : "";
  const periodoLabel = getPeriodoLabel(periodo);

  let resposta = `📅 *Olá${nome}, aqui estão seus compromissos ${periodoLabel}:*\n\n`;

  snapshot.forEach((doc, index) => {
    const r = doc.data();

    const data = new Date(r.when).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      timeZone: "America/Sao_Paulo",
    });

    const horario = new Date(r.when).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Sao_Paulo",
    });

    const actionText = r.text.charAt(0).toUpperCase() + r.text.slice(1);

    resposta += `${index + 1}️⃣ ${data} — ${actionText} às ${horario}\n`;
  });

  return resposta;
}

function getPeriodoLabel(periodo) {
  const hoje = new Date().toISOString().slice(0, 10);

  if (periodo.tipo === "day") {
    if (periodo.data_inicio === hoje) {
      return "de hoje";
    }

    const amanha = new Date();
    amanha.setDate(amanha.getDate() + 1);
    const amanhaISO = amanha.toISOString().slice(0, 10);

    if (periodo.data_inicio === amanhaISO) {
      return "de amanhã";
    }

    const [y, m, d] = periodo.data_inicio.split("-");
    return `do dia ${d}/${m}`;
  }

  if (periodo.tipo === "week") {
    return "dessa semana";
  }

  if (periodo.tipo === "month") {
    const [y, m] = periodo.data_inicio.split("-");
    return `do mês ${m}/${y}`;
  }

  return "";
}
