import { deleteUserReminder } from "../services/reminderService.js";

export async function deleteReminder(userData, data) {
  if (!data.indice) {
    return "🗑️ Qual lembrete você deseja excluir? (me diga o número)";
  }

  await deleteUserReminder(userData.phone, data.indice);
  return "✅ Lembrete excluído com sucesso!";
}
