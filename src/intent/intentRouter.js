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
          "🚫 Seu limite gratuito acabou\n\n" +
          "Você aproveitou todos os *${FREE_LIMIT} lembretes* do plano free 🙌\n\n" +
          "⏰ Para continuar se organizando sem interrupções, ative o Plano Premium.\n" +
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
  console.log("🔥 routeIntent - userDocId recebido:", userDocId);

  if (!userDocId) {
    console.error("❌ userDocId está vazio!");
    return { message: "Erro ao identificar usuário" };
  }

  const normalized = normalize(text);

  // ✅ Buscar ou criar usuário
  let userData = await getUser(userDocId);

  // Se não existe, criar com stage "new"
  if (!userData) {
    await updateUser(userDocId, {
      stage: "new",
      messages: 0,
      createdAt: Date.now(),
    });
    userData = await getUser(userDocId);
  }

  const stage = userData.stage || "new";
  const name = userData.name || "";

  console.log("📊 STAGE:", stage);
  console.log("👤 NAME:", name);

  // 2️⃣ Delay humano
  await new Promise((r) => setTimeout(r, 1500));

  // ✅ VERIFICAÇÕES DE STAGE ANTES DA IA

  // 🟢 PRIMEIRO CONTATO
  if (stage === "new") {
    await updateUser(userDocId, {
      stage: "first_contact",
      messages: 1,
    });
    return { message: "Oi! 😊 Tudo bem com você?" };
  }

  // 🟡 SEGUNDA INTERAÇÃO → pergunta nome
  if (stage === "first_contact") {
    await updateUser(userDocId, {
      stage: "awaiting_name",
      messages: (userData.messages || 1) + 1,
    });
    return {
      message: "👋 Antes de continuarmos, me diz, qual é o seu nome? 😊",
    };
  }

  // 🧑 USUÁRIO RESPONDEU O NOME
  if (stage === "awaiting_name") {
    const displayName =
      normalized.charAt(0).toUpperCase() + normalized.slice(1);

    await updateUser(userDocId, {
      stage: "confirming_name",
      tempName: displayName,
    });
    return {
      message:
        "✨ *Só confirmando rapidinho...*\n\n" +
        "👉 Seu nome é *${displayName}*?\n\n" +
        "Responda com:\n" +
        "✅ *sim* — para confirmar\n" +
        "❌ *não* — para corrigir",
    };
  }

  // ✅ CONFIRMAÇÃO DO NOME
  if (stage === "confirming_name") {
    if (["sim", "isso", "correto", "pode ser"].includes(normalized)) {
      await updateUser(userDocId, {
        name: userData.tempName,
        stage: "active",
        tempName: null,
      });

      return {
        message:
          "✨ *Perfeito, ${userData.tempName}! Seja bem-vindo(a)* 😊\n\n " +
          "A partir de agora, eu cuido dos seus lembretes.\n\n " +
          "📌 *Você pode me pedir coisas como:*\n" +
          "• me lembra daqui 10 minutos\n " +
          "• amanhã às 17h30 ir para a academia\n" +
          "• listar lembretes\n\n" +
          "Bora começar? 🚀",
      };
    }

    // Se disse "não"
    await updateUser(userDocId, { stage: "awaiting_name" });
    return { message: "Sem problemas! Qual é o seu nome então? 😊" };
  }

  // 🤖 AGORA SIM CHAMA A IA (só para usuários ACTIVE)
  if (stage !== "active") {
    return {
      message: "Ops, algo deu errado. Digite 'reiniciar' para começar de novo.",
    };
  }

  // ✅ ANÁLISE DE INTENÇÃO
  const data = await analyzeIntent(text);
  const phone = userDocId;

  console.log("📦 DATA RECEBIDO:", JSON.stringify(data, null, 2));

  // 🔘 BOTÕES
  if (data.intencao === "premium") {
    return {
      type: "buttons",
      text:
        "💎 Plano Premium\n\n" +
        "✨ Lembretes ilimitados\n" +
        "⏰ Sem interrupções\n" +
        "🔔 Notificações garantidas\n\n" +
        "💰 *Escolha seu plano:*",
      buttons: [
        { id: "mensal_9.90", title: "📅 Mensal - R$ 9,90" },
        { id: "anual_89.90", title: "🎯 Anual - R$ 89,90" },
        { id: "voltar", title: "⬅️ Voltar" },
      ],
    };
  }

  if (data.intencao === "mensal_9.90" || data.intencao === "anual_89.90") {
    const plano = data.intencao === "mensal_9.90" ? "mensal" : "anual";
    const valor = plano === "mensal" ? 9.9 : 89.9;

    const pixData = await createPixPayment(phone, plano, valor);

    if (!pixData || !pixData.qrCode) {
      return { message: "❌ Erro ao gerar pagamento. Tente novamente." };
    }

    return {
      type: "pix",
      text:
        `💳 *Pagamento via Pix*\n\n` +
        `📦 Plano: *${plano === "mensal" ? "Mensal" : "Anual"}*\n` +
        `💰 Valor: *R$ ${valor.toFixed(2)}*\n\n` +
        `👇 Escaneie o QR Code ou copie o código Pix abaixo:`,
      qrCodeBase64: pixData.qrCodeBase64,
      pixCode: pixData.qrCode,
    };
  }

  // 📋 CRIAR LEMBRETE
  if (data.intencao === "criar_lembrete") {
    const check = canCreateReminder(userData);
    if (!check.ok) return check.response;

    return await createReminder(data, userDocId);
  }

  // 📝 LISTAR LEMBRETES
  if (data.intencao === "listar_lembretes") {
    return await listReminders(userDocId);
  }

  // 🗑️ EXCLUIR LEMBRETE
  if (data.intencao === "excluir_lembrete") {
    return await deleteReminder(data, userDocId);
  }

  // ℹ️ AJUDA
  if (data.intencao === "ajuda" || data.intencao === "saudacao") {
    return {
      message:
        `👋 Olá${
          name ? `, ${name}` : ""
        }! Sou seu assistente de lembretes!\n\n` +
        `📋 Posso te ajudar com:\n\n` +
        `• ✅ Criar lembretes\n` +
        `• 📝 Listar lembretes\n` +
        `• 🗑️ Excluir lembretes\n\n` +
        `Exemplo: 'me lembra de comprar pão amanhã às 10h'`,
    };
  }

  // ❓ NÃO ENTENDEU
  return {
    message:
      "🤔 Desculpa, não entendi direito.\n\n" +
      "Tenta algo como:\n" +
      "• me lembra de ligar pro João amanhã às 14h\n" +
      "• listar lembretes\n" +
      "• excluir lembrete",
  };
}
