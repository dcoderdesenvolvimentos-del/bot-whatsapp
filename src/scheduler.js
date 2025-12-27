import { getPendingReminders, markAsSent } from "./reminders.js";
import { sendMessage } from "./zapi.js";

export function startScheduler() {
  console.log("⏱️ Scheduler iniciado");

  setInterval(async () => {
    console.log("🔁 Verificando lembretes...");

    const pendentes = await getPendingReminders();
    console.log("📦 Pendentes:", pendentes.length);

    for (const reminder of pendentes) {
      console.log("🧪 reminder.when =", reminder.when);
      console.log("🧪 typeof =", typeof reminder.when);

      // 🔹 converte timestamp em data legível
      let dateObj;

      if (reminder.when?.seconds) {
        // Firestore Timestamp
        dateObj = new Date(reminder.when.seconds * 1000);
      } else {
        // Date ou timestamp normal
        dateObj = new Date(reminder.when);
      }

      const formattedDate = dateObj.toLocaleDateString("pt-BR");
      const formattedTime = dateObj.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      });

      // 🔹 mensagem final
      const message = `━━━━━━━━━━━━━━
⏰ *LEMBRETE*
━━━━━━━━━━━━━━

📌 *${reminder.text}*
🗓 ${formattedDate}
🕔 ${formattedTime}

💡 Estou passando pra te lembrar 😉`;

      await sendMessage(reminder.user, message);

      await markAsSent(reminder.id);
    }
  }, 30_000);
}
