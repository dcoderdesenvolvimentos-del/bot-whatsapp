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

const normalized = normalize(text);
const userData = await getUser(userDocId);

// 1️⃣ Buscar dados do usuário PRIMEIRO

const stage = userData.stage || "new";
const name = userData.name || "";

// 2️⃣ Delay humano DEPOIS que as variáveis existem
await new Promise((r) => setTimeout(r, 1500));

// 🟢 PRIMEIRO CONTATO (anti-ban)
if (!userData) {
  await updateUser(userDocId, {
    stage: "first_contact",
    messages: 1,
    createdAt: Date.now(),
  });

  return "Oi! 😊Tudo bem com você?";
}

// 🟢 USUÁRIO EXISTE MAS ESTÁ "NEW"
if (userData.stage === "new") {
  await updateUser(userDocId, { stage: "first_contact" });
  return "Oi! 😊Tudo bem com você?";
}

// 🟡 SEGUNDA INTERAÇÃO → pergunta nome
if (userData.stage === "first_contact") {
  await updateUser(userDocId, {
    stage: "awaiting_name",
    messages: (userData.messages || 1) + 1,
  });

  return "*👋 Antes de continuarmos, me diz, qual é o seu nome? 😊";
}

// 🧑 USUÁRIO RESPONDEU O NOME
if (userData.stage === "awaiting_name") {
  const displayName = normalized.charAt(0).toUpperCase() + normalized.slice(1);

  await updateUser(userDocId, {
    stage: "confirming_name",
    tempName: displayName,
  });
  return (
    `✨ *Só confirmando rapidinho...*\n\n` +
    `👉 Seu nome é *${displayName}*?\n\n` +
    `Responda com:\n` +
    `✅ *sim* — para confirmar\n` +
    `❌ *não* — para corrigir\n`
  );
}

if (userData.stage === "confirming_name") {
  if (["sim", "isso", "correto", "pode ser"].includes(normalized)) {
    await updateUser(userDocId, {
      stage: "active",
      tempName: null,
    });

    return (
      `✨ *Perfeito, ${userData.tempName}! Seja bem-vindo(a)* 😊\n\n` +
      `A partir de agora, eu cuido dos seus lembretes.\n\n` +
      `📌 *Você pode me pedir coisas como:*\n` +
      `• me lembra daqui 10 minutos\n` +
      `• amanhã às 17h30 ir para a academia\n` +
      `• listar lembretes\n\n` +
      `• excluir lembretes\n\n` +
      `🎤 Prefere áudio? Pode mandar.\n` +
      `📋 Prefere texto? Também funciona.\n\n` +
      `É só me dizer 😉`
    );
  }

  if (["nao", "não", "errado"].includes(normalized)) {
    await updateUser(userDocId, {
      stage: "awaiting_name",
      tempName: null,
    });

    return "Sem problema 😊 Qual é o seu nome então?";
  }

  return "Responda apenas *sim* ou *não*, por favor 🙂";
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

export async function routeIntent(userDocId, text) {
  console.log("🔥 routeIntent - userDocId recebido:", userDocId); // DEBUG

  if (!userDocId) {
    console.error("❌ userDocId está vazio!");
    return { message: "Erro ao identificar usuário" };
  }

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

    const pix = await createPixPayment(userDocId, planKey);

    console.log("🧾 pix.payment_id salvo no usuário:", pix.payment_id);

    await updateUser(userDocId, {
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

  const phone = userDocId; // ✅ CERTO (já é o ID!) ← pega o ID do documento (que é o telefone)
  console.log("👤 USER:", phone);
  console.log("👤 USER:", phone);
  console.log("💬 TEXT:", text);

  try {
    const data = await analyzeIntent(text);
    console.log("📦 DATA RECEBIDO:", JSON.stringify(data, null, 2));

    // passa o userDoc pros handlers
    let response = "";

    switch (data.intencao) {
      case "criar_lembrete":
        response = await createReminder(userDocId, data); // ← só 2 params
        break;

      case "listar_lembretes":
        response = await listReminders(userDocId, data);
        break;

      case "excluir_lembrete":
        response = await deleteReminder(userDocId, data);
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
