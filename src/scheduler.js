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

        if (reminder.when?.seconds) {
          dateObj = new Date(reminder.when.seconds * 1000);
        } else {
          dateObj = new Date(reminder.when);
        }

        const formattedDate = dateObj.toLocaleDateString("pt-BR", {});
        const formattedTime = dateObj.toLocaleTimeString("pt-BR", {
          timeZone: "America/Sao_Paulo",
          hour: "2-digit",
          minute: "2-digit",
        });

        function capitalizeFirst(text) {
          if (!text || typeof text !== "string") return "";
          return text.charAt(0).toUpperCase() + text.slice(1);
        }

        const actionText = capitalizeFirst(reminder.text);

        // 👇 NOVO: Se tiver valor, oferece registrar gasto
        let message;

        if (reminder.temGasto && reminder.valor) {
          message = `⏰ *_LEMBRETE DE PAGAMENTO_*
━━━━━━━━━━━━━━
📌 *${actionText}*
💰 Valor: *R$ ${reminder.valor.toFixed(2)}*
🗓 ${formattedDate}
🕔 ${formattedTime}

Já pagou? Responda:
✅ *"Sim, paguei"* - registro o gasto
❌ *"Ainda não"* - te lembro depois`;
        } else {
          message = `⏰ *_LEMBRETE_*
━━━━━━━━━━━━━━
📌 *${actionText}*
🗓 ${formattedDate}
🕔 ${formattedTime}
💡 Estou passando pra te lembrar 😉`;
        }

        await sendMessage(reminder.phone, message);

        // 👇 Se NÃO tem gasto, marca como enviado
        if (!reminder.temGasto) {
          await markAsSent(reminder.id);
        } else {
          // Se tem gasto, aguarda confirmação
          await db.collection("reminders").doc(reminder.id).update({
            aguardandoConfirmacao: true,
            enviadoEm: Date.now(),
          });
        }

        console.log("✅ Lembrete enviado:", reminder.id);
      }
    } catch (err) {
      console.error("❌ Erro no scheduler:", err);
    } finally {
      isRunning = false;
    }
  }, 60_000);
}
