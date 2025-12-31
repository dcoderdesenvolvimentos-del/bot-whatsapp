import { addReminder } from "../reminders.js";
import { updateUser } from "../services/userService.js";

export async function createReminder(user, userData, data) {
  const FREE_LIMIT = 3;

  const remindersUsed = userData.remindersUsed || 0;
  const isPremium =
    userData.plan === "premium" &&
    userData.premiumUntil &&
    userData.premiumUntil > Date.now();

  function capitalizeFirst(text) {
    if (!text) return "";
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  // 🔒 BLOQUEIO IGUAL AO SEU ANTIGO
  if (!isPremium && remindersUsed >= FREE_LIMIT) {
    return (
      "🚫 *Seu limite gratuito acabou*\n\n" +
      `Você já usou os *${FREE_LIMIT} lembretes* do plano free 🙌\n\n` +
      "💎 Ative o *Plano Premium* para criar lembretes ilimitados."
    );
  }

  // 🔹 VALIDAÇÃO SIMPLES
  if (!data?.acao || !data?.hora) {
    return "⏰ Me diga o que devo lembrar e o horário certinho 😊";
  }

  await addReminder(user, {
    text: data.acao,
    when: data.hora,
  });

  // 🔢 ATUALIZA CONTADOR (IGUAL ANTES)
  await updateUser(user, {
    remindersUsed: remindersUsed + 1,
  });

  // Formatar data e hora
  const dataHora = new Date(data.hora);
  const dataFormatada = dataHora.toLocaleDateString("pt-BR");
  const horaFormatada = dataHora.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const acao = capitalizeFirst(data.acao);

  return (
    `✅ *Lembrete salvo com sucesso!*\n\n` +
    `📌 *Ação:* ${acao}\n` +
    `📅 *Data:* ${dataFormatada}\n` +
    `⏰ *Horário:* ${horaFormatada}`
  );
}
