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

  return "✅ Lembrete criado com sucesso!";
}
