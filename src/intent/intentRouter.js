import { analyzeIntent } from "../ai/aiService.js";
import { createReminder } from "./createReminder.js";
import { listReminders } from "./listReminders.js";
import { deleteReminder } from "./deleteReminder.js";
import { getOrCreateUser } from "../services/userService.js";
import { createPixPayment } from "./mercadoPago.js";
import { getUser, updateUser } from "../services/userService.js";

function normalize(text = "") {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function capitalizeWords(text = "") {
  return text
    .toLowerCase()
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/* =========================
   REGRA DE NEGÓCIO
========================= */

function canCreateReminder(userData, qty = 1) {
  const FREE_LIMIT = 3;

  const remindersUsed = userData.remindersUsed ?? 0;

  const isPremium =
    userData.plan === "premium" &&
    userData.premiumUntil &&
    userData.premiumUntil > Date.now();

  if (isPremium) return { ok: true };

  if (remindersUsed + qty > FREE_LIMIT) {
    return {
      ok: false,
      response: {
        type: "buttons",
        text:
          "🚫 *Seu limite gratuito acabou*\n\n" +
          `Você aproveitou todos os *${FREE_LIMIT} lembretes* do plano free 🙌\n\n` +
          "⏰ Para continuar se organizando sem interrupções, ative o *Plano Premium*.\n" +
          "Com ele, seus lembretes não têm limite.\n" +
          "✨ Ativação rápida • Pagamento via Pix • Liberação automática\n\n" +
          "💎 Selecione uma opção abaixo e continue agora mesmo",
        buttons: [
          { id: "premium", title: "💎 Premium" },
          { id: "saiba_mais", title: "ℹ️ Saiba mais" },
        ],
      },
    };
  }

  return { ok: true };
}

/* =========================
   ROUTER PRINCIPAL
========================= */

export async function routeIntent(userDoc, text) {
  const normalized = normalize(text);
  const userData = await getUser(user);

  // =========================
  // AQUI O CLIENTE ESCOLHE UM PLANO
  // =========================

  const planMap = {
    plano_mensal: "monthly",
    plano_trimestral: "quarterly",
    plano_semestral: "semiannual",
    plano_anual: "annual",

    // fallback se o usuário digitar
    mensal: "monthly",
    trimestral: "quarterly",
    semestral: "semiannual",
    anual: "annual",
  };

  if (planMap[normalized]) {
    const planKey = planMap[normalized];

    const pix = await createPixPayment(user, planKey);

    console.log("🧾 pix.payment_id salvo no usuário:", pix.payment_id);

    await updateUser(user, {
      pendingPayment: pix.payment_id,
      pendingPlan: planKey,
    });

    return {
      type: "pix",
      intro:
        "📲 *PIX Copia e Cola*\n\nCopie o código abaixo e cole no app do seu banco 👇",
      code: pix.pix_copia_e_cola,
    };
  }

  // =========================
  // AQUI O CLIENTE QUER CONTRATAR UM PLANO
  // =========================

  // 💎 CLIQUE NO BOTÃO PREMIUM
  if (normalized === "premium") {
    return {
      type: "buttons",
      text:
        "💎 *Plano Premium — Bot de Lembretes*\n\n" +
        "Chega de se preocupar com limites e perda de horários importantes ⏰\n\n" +
        "✨ *Com o Premium você desbloqueia:*\n\n" +
        "✅ *Lembretes ilimitados* — crie quantos quiser\n" +
        "🔔 Alertas sempre no horário certo\n" +
        "📅 Mais organização no seu dia a dia\n" +
        "⚡ Uso sem bloqueios ou interrupções\n\n" +
        "👇 *Selecione um plano abaixo:*\n",

      buttons: [
        { id: "plano_mensal", title: "🗓️ Mensal — R$ 9,90" },
        { id: "plano_trimestral", title: "📆 Trimestral — R$ 27,90" },
        { id: "plano_semestral", title: "🧾 Semestral — R$ 49,90" },
        { id: "plano_anual", title: "🏆 Anual — R$ 89,90" },
      ],
    };
  }

  // 🗓️ PLANO MENSAL
  if (normalized === "plano_mensal") {
    return "🗓️ *Plano Mensal selecionado*\n\nValor: *R$ 9,90*\n\nGerando pagamento… 💳";
  }

  // 📆 PLANO TRIMESTRAL
  if (normalized === "plano_trimestral") {
    return "📆 *Plano Trimestral selecionado*\n\nValor: *R$ 27,90*\n\nGerando pagamento… 💳";
  }

  // 🧾 PLANO SEMESTRAL
  if (normalized === "plano_semestral") {
    return "🧾 *Plano Semestral selecionado*\n\nValor: *R$ 49,90*\n\nGerando pagamento… 💳";
  }

  // 🏆 PLANO ANUAL
  if (normalized === "plano_anual") {
    return "🏆 *Plano Anual selecionado*\n\nValor: *R$ 89,90*\n\nGerando pagamento… 💳";
  }

  // ℹ️ CLIQUE NO BOTÃO SAIBA MAIS
  if (normalized === "saiba_mais") {
    return (
      "ℹ️ *Sobre o Plano Premium*\n\n" +
      "O Premium foi pensado para quem usa lembretes no dia a dia e quer mais tranquilidade 😊\n\n" +
      "🎯 *Ideal para você que:*\n\n" +
      "🚀 Cria lembretes com frequência\n" +
      "📅 Quer se organizar melhor\n" +
      "⏰ Não quer correr o risco de esquecer compromissos\n" +
      "🔕 Não quer travas ou limitações\n\n" +
      "Com o Premium, você usa o bot sem preocupações e deixa ele cuidar dos seus horários 😉\n\n" +
      "💎 Quando quiser ativar, é só digitar *premium*"
    );
  }

  console.log("🚨 ROUTE INTENT EXECUTADO");

  const phone = userDoc.id; // ← pega o ID do documento (que é o telefone)
  console.log("👤 USER:", phone);
  console.log("💬 TEXT:", text);

  try {
    const data = await analyzeIntent(text);
    console.log("📦 DATA RECEBIDO:", JSON.stringify(data, null, 2));

    // passa o userDoc pros handlers
    let response = "";

    switch (data.intencao) {
      case "criar_lembrete":
        response = await createReminder(userDoc, data); // ← só 2 params
        break;

      case "listar_lembretes":
        response = await listReminders(userDoc, data);
        break;

      case "excluir_lembrete":
        response = await deleteReminder(userDoc, data);
        break;

      case "saudacao":
        response =
          "👋 Olá! Sou seu assistente de lembretes!\n\n" +
          "📋 Posso te ajudar com:\n\n" +
          "• ✅ Criar lembretes\n" +
          "• 📝 Listar lembretes\n" +
          "• 🗑️ Excluir lembretes\n\n" +
          "Exemplo: 'me lembra de comprar pão amanhã às 10h'";
        break;

      case "ajuda":
        response =
          "🤖 *Como usar o bot de lembretes:*\n\n" +
          "📌 *Criar:* 'me lembra de tomar água daqui 2 minutos'\n" +
          "📋 *Listar:* 'quais são meus lembretes?'\n" +
          "🗑️ *Excluir:* 'apaga o lembrete 1'\n\n" +
          "💡 *Dica:* Use linguagem natural!";
        break;

      case "despedida":
        response = "👋 Até logo! Estou aqui quando precisar! 😊";
        break;

      default:
        response =
          "🤔 Desculpa, não entendi.\n\n" +
          "Tente:\n" +
          "• 'me lembra de X amanhã às 10h'\n" +
          "• 'lista meus lembretes'\n" +
          "• 'apaga o lembrete 1'";
    }

    return response;
  } catch (error) {
    console.error("❌ Erro no routeIntent:", error);
    return "❌ Ops! Algo deu errado. Tente novamente.";
  }
}
