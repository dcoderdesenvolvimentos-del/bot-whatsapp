import { addReminder } from "../reminders.js";
import { updateUser } from "../services/userService.js";

export async function createMultipleReminders(user, userData, data) {
  const FREE_LIMIT = 3;

  const remindersUsed = userData.remindersUsed || 0;
  const isPremium =
    userData.plan === "premium" &&
    userData.premiumUntil &&
    userData.premiumUntil > Date.now();

  const totalNovos = data.lembretes.length;
  const totalDepois = remindersUsed + totalNovos;

  // 🔒 BLOQUEIO FREE
  if (!isPremium && totalDepois > FREE_LIMIT) {
    return (
      "🚫 *Seu limite gratuito não permite salvar todos esses lembretes*\n\n" +
      `Você tentou salvar *${totalNovos}*, mas seu plano free permite até *${FREE_LIMIT}* no total.\n\n` +
      "💎 Ative o *Plano Premium* para salvar todos de uma vez."
    );
  }

  // 🧠 SALVA UM POR UM (igual seu código antigo)
  for (const item of data.lembretes) {
    await addReminder(user, {
      text: item.acao.charAt(0).toUpperCase() + item.acao.slice(1),
      when: item.hora,
    });
  }

  await updateUser(user, {
    remindersUsed: totalDepois,
  });

  return (
    "✅ *Lembretes salvos com sucesso!*\n\n" +
    data.lembretes
      .map(
        (l, i) =>
          `${i + 1}. ${l.acao.charAt(0).toUpperCase() + l.acao.slice(1)}`
      )
      .join("\n")
  );
}
