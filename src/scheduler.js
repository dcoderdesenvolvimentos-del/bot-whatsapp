import { getPendingReminders, markAsSent } from "./services/reminderService.js";
import { sendMessage } from "./zapi.js";
import { db } from "./config/firebase.js";
import { Timestamp } from "firebase-admin/firestore";

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

        const link = `https://app.marioai.com.br/m/${dashboardSlug}`;

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
        await markAsSent(r.uid, r.id, r);
      }

      // 🔥 2️⃣ VERIFICA TRIALS
      await verificarTrials();
    } catch (err) {
      console.error("❌ Erro no scheduler:", err);
    } finally {
      isRunning = false;
    }
  }, 60_000);
}

async function verificarTrials() {
  const agora = new Date();
  const em24h = new Date();
  em24h.setHours(em24h.getHours() + 24);

  const snap = await db.collection("users").where("premium", "==", false).get();

  for (const doc of snap.docs) {
    const user = doc.data();

    if (!user.phone) continue;
    if (!user.trialEndsAt) continue;

    const trialDate = user.trialEndsAt.toDate();

    // ─────────────────────────────
    // 1️⃣ AVISO 24H ANTES
    // ─────────────────────────────
    if (!user.trialWarningSent && trialDate <= em24h && trialDate > agora) {
      const linkPlano = "https://pay.hotmart.com/SEULINK";

      await sendButtonList(
        user.phone,
        "⚠️ *Seu período gratuito termina em menos de 24h!*\n\n" +
          "Você já organizou seus gastos e lembretes com o Mário.\n\n" +
          "Não perca acesso agora 😉\n\n" +
          "💎 Ative o Premium aqui:\n" +
          linkPlano +
          "\n\nOu clique no botão abaixo 👇",
        [
          {
            id: "contratar_premium",
            text: "💎 Contratar Premium",
          },
        ],
      );

      await db.collection("users").doc(doc.id).update({
        trialWarningSent: true,
      });

      console.log("📣 Aviso de fim de trial enviado:", user.phone);
    }

    // ─────────────────────────────
    // 2️⃣ TRIAL EXPIRADO
    // ─────────────────────────────
    if (!user.trialExpiredNotified && trialDate <= agora) {
      await sendMessage(
        user.phone,
        "🔒 Seu período gratuito do Mário terminou.\n\n" +
          "Para continuar usando todos os recursos, ative o Premium:\n" +
          "https://pay.hotmart.com/SEULINK",
      );

      await db.collection("users").doc(doc.id).update({
        trialExpiredNotified: true,
      });

      console.log("⛔ Trial expirado notificado:", user.phone);
    }
  }
}
