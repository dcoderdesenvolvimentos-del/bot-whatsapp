import { getPendingReminders, markAsSent } from "./services/reminderService.js";
import { sendMessage } from "./zapi.js";
import { db } from "./config/firebase.js";

let isRunning = false;

export function startScheduler() {
  console.log("⏱️ Scheduler iniciado");

  setInterval(async () => {
    if (isRunning) return;
    isRunning = true;

    try {
      const pendentes = await getPendingReminders();

      for (const r of pendentes) {
        // 🔹 busca o usuário
        const userSnap = await db.collection("users").doc(r.uid).get();
        if (!userSnap.exists) continue;

        const { phone, dashboardSlug } = userSnap.data();
        if (!phone || !dashboardSlug) continue;

        const dateObj = r.when.toDate();

        const link = `https://flourishing-cassata-5ced2a.netlify.app/m/${dashboardSlug}`;

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

📊 Ver no dashboard:
${link}

💡 Estou passando pra te lembrar 😉`;

        await sendMessage(phone, msg);
        await markAsSent(r.uid, r.id);
      }
    } catch (err) {
      console.error("❌ Erro no scheduler:", err);
    } finally {
      isRunning = false;
    }
  }, 60_000);
}
