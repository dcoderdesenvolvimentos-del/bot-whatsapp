import { getPendingReminders, markAsSent } from "./reminders.js";
import { sendMessage } from "./zapi.js";

let isRunning = false;

export function startScheduler() {
  console.log("⏱️ Scheduler iniciado");

  setInterval(async () => {
    // 🔒 evita execução simultânea
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

        if (reminder.when?.seconds) {
          dateObj = new Date(reminder.when.seconds * 1000);
        } else {
          dateObj = new Date(reminder.when);
        }

        const dateObj1 = new Date(when);
        const formattedDate = dateObj1.toLocaleDateString("pt-BR", {
          timeZone: "America/Sao_Paulo",
        });

        const formattedTime = dateObj1.toLocaleTimeString("pt-BR", {
          timeZone: "America/Sao_Paulo",
          hour: "2-digit",
          minute: "2-digit",
        });

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
    } catch (err) {
      console.error("❌ Erro no scheduler:", err);
    } finally {
      isRunning = false;
    }
  }, 60_000); // ⏱️ 60 segundos (ideal pra produção)
}
