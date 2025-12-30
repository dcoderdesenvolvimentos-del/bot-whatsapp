import { getUserReminders } from "../services/reminderService.js";

export async function listReminders(userData) {
  const reminders = await getUserReminders(userData.phone);

  if (!reminders.length) {
    return "📭 Você não tem lembretes salvos.";
  }

  const msg = reminders
    .map(
      (r, i) =>
        `${i + 1}. ${r.message} - ${new Date(r.datetime).toLocaleString(
          "pt-BR"
        )}`
    )
    .join("\n");

  return "📋 Seus lembretes:\n" + msg;
}
