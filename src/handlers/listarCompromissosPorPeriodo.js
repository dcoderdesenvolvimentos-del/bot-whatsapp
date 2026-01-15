import { db } from "../firebase.js";

function startOfDay(dateStr) {
  return new Date(dateStr + "T00:00:00").getTime();
}

function endOfDay(dateStr) {
  return new Date(dateStr + "T23:59:59").getTime();
}

export async function listarCompromissosPorPeriodo({ userId, periodo }) {
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

  let resposta = "📅 *Seus compromissos:*\n\n";

  snapshot.forEach((doc) => {
    const r = doc.data();
    const horario = new Date(r.when).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });

    function capitalizeFirst(text) {
      if (!text || typeof text !== "string") return "";
      return text.charAt(0).toUpperCase() + text.slice(1);
    }

    const actionText = capitalizeFirst(r.text);

    resposta += `• ${actionText} às ${horario}\n`;
  });

  return resposta;
}
