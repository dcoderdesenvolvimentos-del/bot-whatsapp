import { getPendingReminders, markAsSent } from "./services/reminderService.js";
import { sendMessage } from "./zapi.js";

let isRunning = false;

export function startScheduler() {
  console.log("⏱️ Scheduler iniciado");

  setInterval(async () => {
    if (isRunning) {
      console.log("⏳ Scheduler ainda em execução, pulando ciclo");
      return;
    }

    isRunning = true;

    try {
      console.log("🔁 Verificando lembretes...");

      const pendentes = await getPendingReminders();
      console.log("📦 Pendentes:", pendentes.length);

      for (const reminder of pendentes) {
        let dateObj;

        // Converte Timestamp do Firebase ou número
        if (reminder.when?.seconds) {
          dateObj = new Date(reminder.when.seconds * 1000);
        } else {
          dateObj = new Date(reminder.when);
        }

        const formattedDate = dateObj.toLocaleDateString("pt-BR", {});

        const formattedTime = dateObj.toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        });

        function capitalizeFirst(text) {
          if (!text || typeof text !== "string") return "";
          return text.charAt(0).toUpperCase() + text.slice(1);
        }

        console.log("NOW:", new Date().toString());
        console.log("ISO:", new Date().toISOString());

        const actionText = capitalizeFirst(reminder.text);

        const message = `⏰ *_LEMBRETE_*
━━━━━━━━━━━━━━
📌 *${actionText}*
🗓 ${formattedDate}
🕔 ${formattedTime}
💡 Estou passando pra te lembrar 😉`;

        await sendMessage(reminder.phone, message);
        await markAsSent(reminder.id);

        console.log("✅ Lembrete enviado:", reminder.id);
      }
    } catch (err) {
      console.error("❌ Erro no scheduler:", err);
    } finally {
      isRunning = false;
    }
  }, 60_000);
}
