import { db } from "../firebase.js";
console.log("DEBUG RESPONSE:", response);
console.log("DEBUG RESPONSE.PERIODO:", response?.periodo);

export async function listarCompromissosPorPeriodo({ userId, periodo }) {
  const { data_inicio, data_fim } = periodo;

  const snapshot = await db
    .collection("reminders")
    .where("userId", "==", userId)
    .where("data", ">=", data_inicio)
    .where("data", "<=", data_fim)
    .orderBy("data", "asc")
    .get();

  if (snapshot.empty) {
    return "📭 Você não tem compromissos nesse período.";
  }

  let resposta = "📅 *Seus compromissos:*\n\n";

  snapshot.forEach((doc) => {
    const c = doc.data();
    resposta += `• ${c.data} às ${c.hora} — ${c.titulo}\n`;
  });

  return resposta;
}
