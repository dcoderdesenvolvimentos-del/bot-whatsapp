import { getPendingReminders, markAsSent } from "./services/reminderService.js";
import { sendMessage } from "./zapi.js";

let isRunning = false;

export function startScheduler() {
  console.log("⏱️ Scheduler iniciado");

  setInterval(async () => {
    if (isRunning) return;
    isRunning = true;

    try {
      const pendentes = await getPendingReminders();

      for (const r of pendentes) {
        // 🔥 CORREÇÃO PRINCIPAL
        const dateObj = r.when.toDate();

        const msg = `⏰ *_LEMBRETE_*
━━━━━━━━━━━━━━
📌 *${r.text}*
🗓 ${dateObj.toLocaleDateString("pt-BR", {
          timeZone: "America/Sao_Paulo",
        })}
🕔 ${dateObj.toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "America/Sao_Paulo",
        })}
💡 Estou passando pra te lembrar 😉`;

        await sendMessage(r.phone, msg);
        await markAsSent(r.id);
      }
    } catch (err) {
      console.error("❌ Erro no scheduler:", err);
    } finally {
      isRunning = false;
    }
  }, 60_000);
}
