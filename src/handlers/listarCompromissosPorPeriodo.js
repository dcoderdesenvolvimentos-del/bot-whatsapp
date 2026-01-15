import { db } from "../firebase.js";

export async function listarCompromissosPorPeriodo({ userId, periodo }) {
  if (!periodo?.data_inicio || !periodo?.data_fim) {
    return "⚠️ Não consegui identificar o período dos compromissos.";
  }

  const start = new Date(periodo.data_inicio + "T00:00:00").getTime();
  const end = new Date(periodo.data_fim + "T23:59:59").getTime();

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

  let resposta = "📅 *Olá, aqui estão seus compromissos:*\n\n";

  snapshot.forEach((doc, index) => {
    const r = doc.data();
    const horario = new Date(r.when).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });

    resposta += `${index + 1}️⃣ ${r.text} — ⏰ ${horario}\n`;
  });

  return resposta;
}
