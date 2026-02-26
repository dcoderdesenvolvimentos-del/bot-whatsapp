import { getPendingReminders, markAsSent } from "./services/reminderService.js";
import { sendMessage, sendButtonList } from "./zapi.js";
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
      await sendButtonList(
        user.phone,
        "⚠️ *Falta menos de 24h para seu acesso gratuito terminar.*\n\n" +
          "Você já começou a organizar sua vida com o Mário.\n\n" +
          "Não perca seus:\n" +
          "✔ Lembretes automáticos\n" +
          "✔ Controle financeiro completo\n" +
          "✔ Dashboard online 24h\n\n" +
          "Escolha como continuar 👇\n\n" +
          "🔥 *Melhor opção:* Plano Anual sai muito mais barato.",
        [
          { id: "PLANO_MENSAL", label: "Mensal — R$ 17,99" },
          {
            id: "PLANO_ANUAL",
            label: "Anual — 12x de R$ 15,72",
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
      await sendButtonList(
        user.phone,
        "🔒 *Seu acesso ao Mário foi pausado.*\n\n" +
          "Mas olha só… manter sua vida organizada custa menos que um café por dia ☕\n\n" +
          "Por poucos reais por mês você continua:\n" +
          "✔ Controlando seus gastos\n" +
          "✔ Recebendo lembretes\n" +
          "✔ Acompanhando tudo pelo dashboard\n\n" +
          "Escolha um plano e reative agora 👇",
        [
          { id: "PLANO_MENSAL", label: "Mensal — R$ 17,99" },
          { id: "PLANO_TRIMESTRAL", label: "Trimestral — R$ 47,90" },
          {
            id: "PLANO_SEMESTRAL",
            label: "Semestral — R$ 87,99 🔥",
          },
          {
            id: "PLANO_ANUAL",
            label: "Anual — R$ 151,99 💰",
          },
        ],
      );

      await db.collection("users").doc(doc.id).update({
        trialExpiredNotified: true,
      });

      console.log("⛔ Trial expirado notificado:", user.phone);
    }
  }
}
