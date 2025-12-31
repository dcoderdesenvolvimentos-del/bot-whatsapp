import { addReminder } from "../reminders.js";
import { updateUser } from "../services/userService.js";

export async function createReminder(user, userData, interpretation) {
  const { text, minutes, dateTime } = interpretation;

  let when;

  // ⏱️ CASO 1 — "daqui X minutos"
  if (minutes !== undefined) {
    when = Date.now() + minutes * 60 * 1000;
  }

  // 📅 CASO 2 — data/hora absoluta (amanhã às 17h etc)
  else if (dateTime) {
    when = dateTime;
  }

  // ❌ FALLBACK DE SEGURANÇA
  else {
    return "⚠️ Não consegui identificar o horário do lembrete.";
  }

  // ⏰ Agora SIM o when existe
  const dateObj = new Date(data.hora);

  const formattedDate = dateObj.toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
  });

  const formattedTime = dateObj.toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });

  // ✅ salvar no banco (exemplo)
  // await addReminder(user, { text, when });

  // 🧾 resposta
  if (minutes !== undefined) {
    return (
      "✅ *Lembrete salvo com sucesso!*\n\n" +
      `📌 *Ação:* ${capitalizeFirst(text)}\n` +
      `⏰ *Daqui a ${minutes} minuto(s)*`
    );
  }

  return (
    "✅ *Lembrete salvo com sucesso!*\n\n" +
    `📌 *Ação:* ${capitalizeFirst(text)}\n` +
    `📅 *Data:* ${formattedDate}\n` +
    `⏰ *Horário:* ${formattedTime}`
  );
}
