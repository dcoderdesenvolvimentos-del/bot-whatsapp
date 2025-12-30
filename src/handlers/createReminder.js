import { addReminder } from "../services/reminderService.js";

export async function createReminder(userData, data) {
  if (!data.hora) {
    return "⏰ Qual horário você deseja para o lembrete?";
  }

  await addReminder({
    phone: userData.phone,
    message: data.acao,
    datetime: data.hora,
  });

  // Formatar data e hora
  const dataHora = new Date(data.hora);
  const dataFormatada = dataHora.toLocaleDateString("pt-BR");
  const horaFormatada = dataHora.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    `✅ *Lembrete salvo com sucesso!*\n\n` +
    `📌 *Ação:* ${data.acao}\n` +
    `📅 *Data:* ${dataFormatada}\n` +
    `⏰ *Horário:* ${horaFormatada}`
  );
}
