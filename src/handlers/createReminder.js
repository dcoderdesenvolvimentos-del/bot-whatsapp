import { capitalizeFirst } from "../utils/text.js";
import { addReminder } from "../services/reminderService.js";

export async function createReminder(user, userData, interpretation) {
  const { text, minutes, dateTime } = interpretation;

  // 🚨 PASSO 1 — DEFINIR when (OBRIGATÓRIO)
  let when;

  if (typeof minutes === "number") {
    when = Date.now() + minutes * 60 * 1000;
  } else if (typeof dateTime === "number") {
    when = dateTime;
  } else {
    return "⚠️ Não consegui identificar o horário do lembrete.";
  }

  // 🚨 PASSO 2 — AGORA SIM pode usar when
  const dateObj = new Date(when);

  const formattedDate = dateObj.toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
  });

  const formattedTime = dateObj.toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });

  // 🚨 PASSO 3 — SALVAR
  await addReminder(user, {
    text: capitalizeFirst(text),
    when,
  });

  // 🚨 PASSO 4 — RESPONDER
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
