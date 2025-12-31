import {
  deleteUserReminder,
  getUserReminders,
} from "../services/reminderService.js";

export async function deleteReminder(userData, data) {
  if (!data.indice) {
    return "🗑️ Qual lembrete você deseja excluir? (me diga o número)";
  }

  // Buscar o lembrete antes de excluir para mostrar os detalhes
  const lembretes = await getUserReminders(userData.phone);
  const lembrete = lembretes[data.indice - 1];

  if (!lembrete) {
    return "❌ Lembrete não encontrado!";
  }

  // Formatar data e hora

  const dateObj = new Date(when);
  const dataFormatada = dateObj.toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
  });

  const horaFormatada = dateObj.toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });

  await deleteUserReminder(userData.phone, data.indice);

  return (
    `✅ *Lembrete excluído com sucesso!*\n\n` +
    `📌 *Ação:* ${lembrete.message}\n` +
    `📅 *Data:* ${dataFormatada}\n` +
    `⏰ *Horário:* ${horaFormatada}`
  );
}
