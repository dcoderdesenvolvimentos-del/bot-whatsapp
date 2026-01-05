import { addReminder } from "../services/reminderService.js";
import { updateUser } from "../services/userService.js";

export async function createReminder(userDoc, data) {
  console.log("🔥 CHEGOU NO CREATE REMINDER");

  const phone = userDoc.id; // ← telefone vem do ID do documento

  console.log("🔥 PHONE:", phone);
  console.log("🔥 DATA:", data);

  // valida timestamp
  const timestamp =
    typeof data.hora === "number" ? data.hora : Date.now() + 60000;

  await addReminder(phone, {
    text: data.acao,
    when: timestamp,
  });

  const dataFormatada = new Date(timestamp).toLocaleString("pt-BR");
  return `✅ Lembrete criado!\n📌 ${data.acao}\n🕐 ${dataFormatada}`;
}
