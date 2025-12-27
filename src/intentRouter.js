import { addReminder, listReminders } from "./reminders.js";
import { getUser, updateUser, saveUserName } from "./services/userService.js";
import { askIA } from "./aiFallback.js";
import { setPending, getPending, clearPending } from "./pendingReminders.js";
import { deleteReminderByIndex, deleteAllReminders } from "./reminders.js";
import {
  setConfirmation,
  getConfirmation,
  clearConfirmation,
} from "./state.js";
import { createPixPayment } from "./mercadoPago.js";
import { askName, isAskingName, clearAskName } from "./state.js";
function isCommand(cmds, normalized) {
  return cmds.some((cmd) => normalized === cmd || normalized.includes(cmd));
}

function capitalize(text) {
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

function cleanReminderText(raw) {
  if (!raw) return "";

  let text = raw
    // remove comandos comuns
    .replace(
      /(me lembra|me lembre|lembra|lembrar|cria|criar|lembrete|para mim|pra mim|de|que eu|que|que eu tenho|que tenho|eu tenho|tenho|às|as)/gi,
      ""
    )

    // remove horários (17h, 17h30, às 17h etc)
    .replace(/às?\s*\d{1,2}h\d{0,2}/gi, "")
    .replace(/\b\d{1,2}h\d{0,2}\b/gi, "")

    // limpa espaços extras
    .replace(/\s+/g, " ")
    .trim();

  // Capitaliza só a primeira letra
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

const LIST_KEYS = [
  "listar lembretes",
  "meus lembretes",
  "ver lembretes",
  "mostrar lembretes",
  "quais lembretes",
  "o que eu tenho marcado",
  "lembretes",
  "lembrete",
  "minha lista de lembretes",
  "lista de lembretes",
];

function capitalizeWords(text) {
  if (!text) return "";
  return text
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

const LIST_REGEX = /(listar|ver|mostrar|quais|consultar).*(lembrete|lembretes)/;

async function handleListReminders(user) {
  const reminders = await listReminders(user);
  console.log("🧪 lembretes retornados:", reminders);

  if (!reminders.length) {
    return "📭 Você não tem lembretes cadastrados.";
  }

  return (
    "📋 *Seus Lembretes*\n\n" +
    reminders
      .map((r, i) => {
        const date = new Date(r.when);

        const formattedDate = date.toLocaleDateString("pt-BR");
        const formattedTime = date.toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        });

        return (
          `🔔 *${i + 1}.* ${r.text}\n` +
          `⏰ ${formattedDate} às ${formattedTime}`
        );
      })
      .join("\n\n") +
    "\n\n──────────────\n" +
    "🗑️ *Excluir Lembretes*\n\n" +
    "• Excluir 1: `excluir lembrete 1`\n\n" +
    "• Excluir Todos: `excluir todos os lembretes`"
  );
}

// =========================
// FUNÇÃO: detectar múltiplos lembretes
// =========================
function detectMultipleReminders(text) {
  const matches = text.match(/\b(as\s)?\d{1,2}h\b|\b\d{1,2}:\d{2}\b/g);
  return matches && matches.length >= 2;
}

function parseTime(timeText) {
  const now = new Date();

  // 15h ou 17h30
  const match = timeText.match(/(\d{1,2})h(\d{0,2})/);

  if (!match) return null;

  const hour = parseInt(match[1], 10);
  const minute = match[2] ? parseInt(match[2], 10) : 0;

  const date = new Date(now);
  date.setHours(hour, minute, 0, 0);

  // se horário já passou hoje, agenda para amanhã
  if (date < now) {
    date.setDate(date.getDate() + 1);
  }

  return date.getTime();
}

// =========================
// FUNÇÃO: extrair os lembretes
// =========================
function extractMultipleReminders(normalized) {
  const reminders = [];

  // pega frases + horário (15h, 17h30, 20h etc)
  const regex = /(.+?)\s+as?\s+(\d{1,2}h\d{0,2})/gi;

  let match;

  while ((match = regex.exec(normalized)) !== null) {
    const extractedText = match[1].trim(); // 👈 match SÓ EXISTE AQUI
    const timeText = match[2];

    const time = parseTime(timeText); // sua função existente

    reminders.push({
      text: cleanReminderText(extractedText),
      time,
    });
  }

  return reminders;
}

// =========================
// FUNÇÃO: montar a mensagem de confirmação
// =========================
function formatMultiplePreview(reminders) {
  let msg = "📝 *Encontrei esses lembretes:*\n\n";

  reminders.forEach((r, i) => {
    msg += `${i + 1}. *${r.text}* — ${new Date(r.time).toLocaleTimeString(
      "pt-BR",
      {
        hour: "2-digit",
        minute: "2-digit",
      }
    )}\n`;
  });

  msg +=
    "\nDeseja salvar *TODOS* esses lembretes?\n" + "👉 Responda *SIM* ou *NÃO*";

  return msg;
}

export async function routeIntent(user, text) {
  console.log("🧭 intentRouter", { user, text });

  // 🔹 Normalização segura do texto
  const normalized = (text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .trim();

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

    await updateUser(user, {
      pendingPayment: pix.id,
      pendingPlan: planKey,
    });

    return {
      type: "pix",
      message:
        "📲 PIX Copia e Cola\n\nCopie o código abaixo e cole no app do seu banco 👇",
      pixCode: pix.qrCode,
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
        "📦 *Planos disponíveis:*\n" +
        "• 🗓️ *Mensal* — R$ 9,90\n" +
        "• 📆 *Trimestral* — R$ 27,90 *(melhor custo)*\n" +
        "• 🧾 *Semestral* — R$ 49,90\n" +
        "• 🏆 *Anual* — R$ 89,90 *(economia máxima)*\n\n" +
        "👇 *Selecione um plano abaixo:*\n" +
        "Exemplo: *mensal*",
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

  // =========================
  // NORMALIZAÇÃO NÍVEL 1 (HORAS)
  // =========================

  // "8 horas" → "8h"
  let fixed = normalized.replace(/(\d{1,2})\s*horas?/g, "$1h");

  // "8h da manhã" → "8h"
  fixed = fixed.replace(/(\d{1,2})h\s*da\s*manhã/g, "$1h");

  // "8h da noite" → "20h"
  fixed = fixed.replace(
    /(\d{1,2})h\s*da\s*noite/g,
    (_, h) => `${Number(h) + 12}h`
  );

  // "8h da tarde" → "20h"
  fixed = fixed.replace(
    /(\d{1,2})h\s*da\s*tarde/g,
    (_, h) => `${Number(h) + 12}h`
  );

  // usa o texto corrigido
  const normalizedFixed = fixed;

  console.log("🚫 BLOQUEADO PELO PLANO");

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

  // =========================
  // MÚLTIPLOS LEMBRETES
  // =========================
  const multiple = extractMultipleReminders(normalizedFixed);

  if (multiple && multiple.length > 1) {
    // salva temporariamente para confirmação
    await updateUser(user, {
      stage: "confirming_multiple",
      pendingReminders: multiple,
    });

    return formatMultiplePreview(multiple);
  }

  // =========================
  // TEXTO PARA ANÁLISE DE INTENÇÃO
  // =========================
  const intentText = normalized.replace(/\b(mario)\b/g, "").trim();

  // =========================
  // BUSCA DE PENDÊNCIA DO USUÁRIO
  // =========================
  const pending = await getPending(user);

  const userData = await getUser(user);

  // =========================
  // VERIFICAÇÃO DE PREMIUM (ANTES DE CRIAR LEMBRETE)
  // =========================

  const isPremium =
    userData.plan === "premium" && userData.premiumUntil > Date.now();

  // =========================
  // EXPIRAÇÃO AUTOMATICA DO PLANO
  // =========================

  if (
    userData.plan === "premium" &&
    userData.premiumUntil &&
    userData.premiumUntil < Date.now()
  ) {
    await updateUser(user, {
      plan: "free",
      planType: null,
      premiumUntil: null,
    });
  }

  console.log("🧭 intentRouter", { user, normalized, stage: userData?.stage });

  // 1️⃣ Buscar dados do usuário PRIMEIRO

  const stage = userData.stage || "new";
  const name = userData.name || "";

  // 2️⃣ Delay humano DEPOIS que as variáveis existem
  await new Promise((r) => setTimeout(r, 1500));

  // 🟢 PRIMEIRO CONTATO (anti-ban)
  if (!userData) {
    await updateUser(user, {
      stage: "first_contact",
      messages: 1,
      createdAt: Date.now(),
    });

    return "Oi! 😊Tudo bem com você?";
  }

  // 🟢 USUÁRIO EXISTE MAS ESTÁ "NEW"
  if (userData.stage === "new") {
    await updateUser(user, { stage: "first_contact" });
    return "Oi! 😊Tudo bem com você?";
  }

  // 🟡 SEGUNDA INTERAÇÃO → pergunta nome
  if (userData.stage === "first_contact") {
    await updateUser(user, {
      stage: "awaiting_name",
      messages: (userData.messages || 1) + 1,
    });

    return "*👋 Antes de continuarmos, me diz, qual é o seu nome? 😊";
  }

  // 🧑 USUÁRIO RESPONDEU O NOME
  if (userData.stage === "awaiting_name") {
    const displayName =
      normalized.charAt(0).toUpperCase() + normalized.slice(1);

    await updateUser(user, {
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
      await saveUserName(user, userData.tempName);
      await updateUser(user, {
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
      await updateUser(user, {
        stage: "awaiting_name",
        tempName: null,
      });

      return "Sem problema 😊 Qual é o seu nome então?";
    }

    return "Responda apenas *sim* ou *não*, por favor 🙂";
  }

  // =========================
  // CONFIRMAÇÃO DE MÚLTIPLOS
  // =========================
  if (stage === "confirming_multiple") {
    if (normalized === "sim") {
      const FREE_LIMIT = 3;

      const remindersUsed = userData.remindersUsed ?? 0;

      const isPremium =
        userData.plan === "premium" &&
        userData.premiumUntil &&
        userData.premiumUntil > Date.now();

      const totalToSave = userData.pendingReminders.length;
      const totalAfterSave = remindersUsed + totalToSave;

      // 🔒 BLOQUEIO DE PLANO FREE
      if (!isPremium && totalAfterSave > FREE_LIMIT) {
        return (
          "🚫 *Seu limite gratuito acabou*\n\n" +
          `Você aproveitou todos os *${FREE_LIMIT} lembretes* do plano free 🙌\n\n` +
          "⏰ Para continuar se organizando sem interrupções, ative o *Plano Premium*.\n" +
          "Com ele, seus lembretes não têm limite.\n" +
          "✨ Ativação rápida • Pagamento via Pix • Liberação automática\n\n" +
          "💎 Selecione uma opção abaixo e continue agora mesmo"
        );
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

        const pix = await createPixPayment(user, planKey);

        await updateUser(user, {
          pendingPayment: pix.id,
          pendingPlan: planKey,
        });

        return {
          type: "pix",
          message:
            "📲 PIX Copia e Cola\n\nCopie o código abaixo e cole no app do seu banco 👇",
          pixCode: pix.qrCode,
        };
      }

      // ✅ SALVAR OS LEMBRETES
      for (const r of userData.pendingReminders) {
        if (!r?.text || !r?.time) {
          console.log("❌ Lembrete inválido ignorado:", r);
          continue;
        }

        const guard = canCreateReminder(userData, 1);
        if (!guard.ok) {
          console.log("📤 RETORNANDO BOTÕES");
          return guard.response;
        }

        await addReminder(user, {
          text: capitalizeWords(r.text),
          when: r.time,
        });
      }

      // 🔢 ATUALIZA CONTADOR
      await updateUser(user, {
        remindersUsed: totalAfterSave,
        stage: "active",
        pendingReminders: [],
      });

      return "✅ Todos os lembretes foram salvos com sucesso! ⏰";
    }

    if (normalized === "não" || normalized === "nao") {
      await updateUser(user, {
        stage: "active",
        pendingReminders: [],
      });

      return "❌ Tudo bem, não salvei os lembretes.";
    }

    return "👉 Confirma pra mim: *SIM* ou *NÃO*";
  }

  // =========================
  // SAUDAÇÃO
  // =========================
  if (
    userData.stage === "active" &&
    [
      ".",
      ",",
      "?",
      "oi",
      "ola",
      "olá",
      "boa noite",
      "bom dia",
      "boa tarde",
      "mario",
      "mário",
      "oi mario",
      "ola mario",
      "opa",
      "op",
      "criar lembrete",
      "oi mario tudo bem?",
      "ei mario tudo bem?",
      "ei mario bom dia",
      "ei mario boa tarde",
      "ei mario boa noite",
      "ola mario tudo bem?",
      "ola mario tudo joia",
      "ei mario tudo joia",
      "oi mario tudo joia",
      "ei",
      "ei mario",
      "oba",
      "fala campeão",
      "fala campeao",
      "iae campeão",
      "iae campeao",
      "iai mario",
      "iae mario",
      "iai",
      "iae",

      "i ae campeão",
      "i ae campeao",
      "i ai mario",
      "i ae mario",
      "i ai",
      "i ae",

      "e ae campeão",
      "e ae campeao",
      "e ai mario",
      "e ae mario",
      "e ai",
      "e ae",
      "bot",
      "oi bot",
    ].includes(normalized)
  ) {
    return (
      `👋 *Oi, ${name}!*\n\n` +
      `*Em que posso te ajudar nesse momento?*😊\n\n` +
      `📌 *Exemplos do que você pode pedir:*\n` +
      `• me lembra daqui 10 minutos\n` +
      `• amanhã às 17h30 ir para a academia\n` +
      `• listar lembrete\n` +
      `• excluir lembrete\n\n` +
      `🎤 *Dica:* (Você pode digitar ou mandar um áudio.)\n` +
      `*#Eu_anoto_tudo_pra_você 😉*`
    );
  }

  // =========================
  // SAUDAÇÃO
  // =========================
  if (
    userData.stage === "active" &&
    [
      "criar lembretes",
      "criar lembrete",
      "novo lembrete",
      "criar novo lembretes",
      "criar um novo lembretes",
      "criar 1 novo lembretes",
      "mario eu quero criar um novo lembrete",
      "mario eu quero criar 1 novo lembrete",
      "mario eu quero criar um lembrete",
      "mario eu quero criar 1 lembrete",
      "mario quero criar um novo lembrete",
      "mario quero criar 1 novo lembrete",
      "mario quero criar um lembrete",
      "mario quero criar 1 lembrete",
      "criar outro lembrete",
    ].includes(normalized)
  ) {
    return (
      `👋 *Oi, ${name}!*\n\n` +
      `*Claro, estou a sua disposição!*😊\n\n` +
      `📌 *Exemplos de como você pode falar:*\n` +
      `• me lembra daqui 10 minutos\n` +
      `• amanhã às 17h30 ir para a academia\n\n` +
      `🎤 *Dica:* (Você pode digitar ou mandar um áudio.)\n` +
      `*#Eu_anoto_tudo_pra_você 😉*`
    );
  }

  // ✅ RESPOSTA DE CONFIRMAÇÃO
  const confirmation = getConfirmation(user);

  if (confirmation) {
    if (
      text === "sim" ||
      text === "s" ||
      text === "yes" ||
      text === "ok" ||
      text === "isso"
    ) {
      clearConfirmation(user);

      if (confirmation.type === "deleteOne") {
        await deleteReminderByIndex(user, confirmation.index);
        return `🗑️ Lembrete ${confirmation.index} excluído com sucesso.`;
      }

      if (confirmation.type === "deleteAll") {
        const total = await deleteAllReminders(user);
        return `🗑️ ${total} lembretes excluídos com sucesso.`;
      }
    }

    if (
      text === "não" ||
      text === "nao" ||
      text === "n" ||
      text === "cancelar"
    ) {
      clearConfirmation(user);
      return "❎ Operação cancelada.";
    }

    return "🙏 Tem certeza que deseja excluir?, responda com *sim* ou *não*, por favor.";
  }

  // 🗑️ EXCLUIR UM LEMBRETE
  const deleteOneMatch = text.match(
    /(excluir|apagar|remover|deletar|excluir lembretes|excluir lembretis|excluir lembreti|apagar lembretes|remover lembretes|deletar lembretes|excluir lembrete|apagar lembrete|remover lembrete|deletar lembrete|apagar lembreti|apagar lembretis|deletar lembreti|deletar lembretis|remover lembreti|remover lembretis) lembrete (\d+)/
  );

  if (deleteOneMatch) {
    const index = parseInt(deleteOneMatch[2], 10);

    setConfirmation(user, {
      type: "deleteOne",
      index,
    });

    return "🙏 Tem certeza que deseja excluir?, responda com *sim* ou *não*, por favor.";
  }

  // 🗑️ EXCLUIR TODOS OS LEMBRETES
  if (
    text.includes("excluir todos") ||
    text.includes("apagar todos") ||
    text.includes("remover todos") ||
    text.includes("exclui todos") ||
    text.includes("apaga todos") ||
    text.includes("remove todos") ||
    text.includes("excluir todos os lembretes") ||
    text.includes("apagar  todos os lembretes") ||
    text.includes("remover todos os lembretes") ||
    text.includes("deletar todos") ||
    text.includes("deletar todos os lembretes") ||
    text.includes("delete todos os lembretes") ||
    text.includes("limpar todos") ||
    text.includes("limpar todos os lembretes") ||
    text.includes("deleta todos") ||
    text.includes("delete todos") ||
    text.includes("apague todos") ||
    text.includes("apague todos lembretes") ||
    text.includes("remove todos lembretes")
  ) {
    setConfirmation(user, {
      type: "deleteAll",
    });

    return `⚠️${name}, Tem certeza que deseja excluir *todos* os lembretes? (sim / não)`;
  }

  // 🗑️ EXCLUIR LEMBRETE
  const deleteMatch = text.match(/(excluir|apagar|remover) lembrete (\d+)/);

  if (deleteMatch) {
    const index = parseInt(deleteMatch[2], 10);
    const ok = await deleteReminderByIndex(user, index);

    if (!ok) {
      return "❌ Não encontrei esse lembrete. Verifique o número.";
    }

    return `🗑️ Lembrete ${index} excluído com sucesso.`;
  }

  if (normalized.includes("excluir")) {
    const match = normalized.match(/\d+/);

    if (match) {
      // excluir lembrete específico
      return await deleteReminderByIndex(user, Number(match[0]));
    }

    // 👇 ISSO É O QUE FALTAVA
    return (
      "🗑️ *Quer excluir um lembrete?*\n\n" +
      "É só me dizer como deseja excluir:\n\n" +
      "👉 *Excluir um lembrete específico:*\n" +
      "• `excluir lembrete 1`\n\n" +
      "👉 *Excluir todos os lembretes:*\n" +
      "• `excluir todos os lembretes`\n\n"
    );
  }

  // =========================
  // LISTAR LEMBRETES
  // =========================

  if (LIST_KEYS.some((k) => text.includes(k)) || LIST_REGEX.test(text)) {
    return await handleListReminders(user);
  }

  if (text.includes("listar")) {
    const reminders = await listReminders(user);

    if (!reminders.length) {
      return "📭Ops,  Você não tem lembretes cadastrados.";
    }

    return (
      "📋 *Seus lembretes*\n\n" +
      reminders
        .map((r, i) => {
          const date = new Date(r.time).toLocaleString("pt-BR");
          return `🔹 *${i + 1}.* ${r.text}\n   ⏰ ${date}`;
        })
        .join("\n\n") +
      "\n\n──────────────\n" +
      "🗑️ *Excluir lembretes*\n" +
      "• Excluir um: `excluir lembrete 1`\n" +
      "\n" +
      "• Excluir todos: `excluir todos os lembretes`"
    );
  }

  // =========================
  // CONFIRMAÇÃO (sim / não)
  // =========================
  if (
    [
      "sim",
      "s",
      "confirmar",
      "isso",
      "isso mesmo",
      "certo",
      "Sim",
      "certinho",
      "isso cara",
      "isso mesmo cara",
    ].includes(text)
  ) {
    const pending = getPending(user);

    // 🔒 validação obrigatória
    if (!pending || !pending.text || !pending.time) {
      clearPending(user);
      return (
        `${name}, não encontrei nenhum lembrete pendente para salvar 😕\n\n` +
        "Exemplo:\n" +
        "• me lembra daqui 10 minutos\n" +
        "• amanhã às 17h beber água"
      );
    }

    const when = pending.time;
    const formattedText = capitalizeWords(pending.text);

    const guard = canCreateReminder(userData, 1);
    if (!guard.ok) {
      console.log("📤 RETORNANDO BOTÕES");
      return guard.response;
    }
    if (!guard.ok) return guard.response;

    await addReminder(user, {
      text: formattedText,
      when,
    });

    await updateUser(user, {
      remindersUsed: (userData.remindersUsed || 0) + 1,
    });

    clearPending(user);

    return (
      `⏰ *Prontinho, ${name}!*\n\n` +
      `📝 ${formattedText}\n` +
      `📅 ${new Date(when).toLocaleString("pt-BR")}\n\n` +
      `👍 Te aviso certinho na hora!`
    );
  }

  if (
    [
      "não",
      "nao",
      "cancelar",
      "errado",
      "errou",
      "aff",
      "Nao",
      "Não",
      "deixa",
      "deixa pra la",
    ].includes(text)
  ) {
    clearPending(user);
    return "❌ Lembrete cancelado.";
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
        "📦 *Planos disponíveis:*\n" +
        "• 🗓️ *Mensal* — R$ 9,90\n" +
        "• 📆 *Trimestral* — R$ 27,90 *(melhor custo)*\n" +
        "• 🧾 *Semestral* — R$ 49,90\n" +
        "• 🏆 *Anual* — R$ 89,90 *(economia máxima)*\n\n" +
        "👇 *Selecione um plano abaixo:*\n" +
        "Exemplo: *mensal*",
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

  if (planMap[normalized]) {
    const planKey = planMap[normalized];

    const pix = await createPixPayment(user, planKey);

    await updateUser(user, {
      pendingPayment: pix.id,
      pendingPlan: planKey,
    });

    return {
      type: "pix",
      message:
        "📲 PIX Copia e Cola\n\nCopie o código abaixo e cole no app do seu banco 👇",
      pixCode: pix.qrCode,
    };
  }

  // =========================
  // AGRADECIMENTO
  // =========================
  if (
    [
      "ok",
      "obg",
      "obgd",
      "blz",
      "beleza",
      "positivo",
      "tranquilo",
      "muito obrigado",
      "obrigado",
      "vlw",
      "valeu",
      "tmj",
      "tamo junto",
      "obrigado mario",
      "vlw mario",
      "valeu mario",
      "muito obrigado mario",
      "vlw cara",
    ].includes(text)
  ) {
    return "😊 qualquer coisa estou a disposição.";
  }

  // =========================
  // REGRA SIMPLES (daqui X minutos)
  // =========================

  function normalizeSpeech(text) {
    return text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // remove acentos
      .replace(/\bum\b/g, "1")
      .replace(/\buma\b/g, "1")
      .replace(/\bdois\b/g, "2")
      .replace(/\btres\b/g, "3")
      .replace(/\bquatro\b/g, "4")
      .replace(/\bcinco\b/g, "5")
      .replace(/\bseis\b/g, "6")
      .replace(/\bsete\b/g, "7")
      .replace(/\boito\b/g, "8")
      .replace(/\bnove\b/g, "9")
      .replace(/\bdez\b/g, "10")
      .replace(/\bons?\b/g, "") // remove "uns"
      .replace(/\bmais ou menos\b/g, "")
      .trim();
  }

  const normalizedSpeech = normalizeSpeech(normalized);

  const match = normalizedSpeech.match(
    /daqui\s*(?:a\s*)?(?:uns?\s*)?(\d+)\s*(min|mins|minuto|minutos)/
  );

  if (match) {
    const guard = canCreateReminder(userData, 1);
    if (!guard.ok) {
      console.log("📤 RETORNANDO BOTÕES");
      return guard.response;
    }

    const minutes = Number(match[1]);
    const when = Date.now() + minutes * 60000;

    const formattedText = capitalizeWords(cleanReminderText(text));

    await addReminder(user, {
      text: formattedText,
      when,
    });

    await updateUser(user, {
      remindersUsed: (userData.remindersUsed || 0) + 1,
    });

    return (
      `⏰ *Prontinho, ${name}!*\n\n` +
      `📝 *Tarefa:* ${formattedText}\n` +
      `📅 *Quando:* daqui ${minutes} minuto(s)\n\n` +
      `👍 Pode ficar tranquilo(a), eu te aviso na hora certa 😉`
    );
  }

  // =========================
  // HORÁRIO SEM DIA → ASSUMIR HOJE
  // =========================
  const timeOnlyMatch = normalized.match(/(\d{1,2})h(\d{2})?/);

  if (
    timeOnlyMatch &&
    !normalized.includes("amanha") &&
    !normalized.includes("depois") &&
    !normalized.includes("segunda") &&
    !normalized.includes("terca") &&
    !normalized.includes("quarta") &&
    !normalized.includes("quinta") &&
    !normalized.includes("sexta") &&
    !normalized.includes("sabado") &&
    !normalized.includes("domingo")
  ) {
    const hour = Number(timeOnlyMatch[1]);
    const minute = timeOnlyMatch[2] ? Number(timeOnlyMatch[2]) : 0;

    const now = new Date();
    const target = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      hour,
      minute,
      0,
      0
    );

    // se o horário já passou hoje → amanhã
    if (target < now) {
      target.setDate(target.getDate() + 1);
    }

    const reminderText = cleanReminderText(normalized);

    setPending(user, {
      text: reminderText,
      time: target.getTime(),
    });

    return (
      `⏰ *Entendi assim:*\n\n` +
      `📝 ${reminderText}\n` +
      `📅 ${target.toLocaleString("pt-BR")}\n\n` +
      `Deseja salvar? (sim ou não)`
    );
  }

  // =========================
  // 🧠 IA FALLBACK (áudio / frase livre)
  // =========================
  const ai = await askIA(text);

  if (ai && ai.action === "reminder") {
    const now = new Date();
    let targetDate = null;

    // Dia relativo (amanhã, depois de amanhã)
    if (ai.dayOffset !== null) {
      targetDate = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + ai.dayOffset,
        ai.hour,
        ai.minute,
        0,
        0
      );
    }

    // Dia da semana
    if (ai.weekday !== null) {
      const currentDay = now.getDay();
      let diff = ai.weekday - currentDay;
      if (diff <= 0) diff += 7;

      targetDate = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + diff,
        ai.hour,
        ai.minute,
        0,
        0
      );
    }

    if (targetDate) {
      setPending(user, {
        text: ai.text,
        time: targetDate.getTime(),
      });

      const formattedText = capitalizeWords(ai.text);

      return (
        `📝 ${name}, Entendi o lembrete:\n"*${formattedText}*"\n\n` +
        `📅 ${targetDate.toLocaleString("pt-BR")}\n\n` +
        "Deseja salvar? (sim ou não)"
      );
    }
  }

  if (normalized && normalized.length < 4) {
    return "🎤 Não consegui entender muito bem. Pode repetir?";
  }

  // =========================
  // PIADINHA / PERSONALIDADE
  // =========================

  const hasTime =
    /\b\d{1,2}h\b/.test(normalized) ||
    /\b\d{1,2}h\d{1,2}\b/.test(normalized) ||
    normalized.includes("minuto") ||
    normalized.includes("hora");

  if (
    !hasTime &&
    (intentText.includes("quem e") ||
      intentText.includes("quem") ||
      intentText.includes("e") ||
      intentText.includes("voce conhece") ||
      intentText.includes("sabe quem e") ||
      intentText.includes("quem e esse") ||
      intentText.includes("ouviu falar no") ||
      intentText.includes("ouviu falar em") ||
      intentText.includes("ouviu falar ne") ||
      intentText.includes("viu o") ||
      intentText.includes("onde esta o") ||
      intentText.includes("piada do") ||
      intentText.includes("pegadinha do"))
  ) {
    return (
      "😄 *Essa piada eu já conheço!* \n\n" +
      "✨ *Mas deixa eu te contar uma melhor:* \n\n" +
      "😂 *Por que o computador foi ao médico?* \n" +
      "👉 Porque ele estava com *vírus*! 😅💻\n\n" +
      "———\n" +
      "Agora falando sério 😉\n\n" +
      "📌 Em que posso te ajudar?\n" +
      "• Criar lembretes ⏰\n" +
      "• Listar seus lembretes 📋\n" +
      "• Excluir quando quiser 🗑️\n\n" +
      "É só me dizer ✨"
    );
  }

  const marioJokeTriggers = [
    ["quem", "mario"],
    ["mario", "armario"],
    ["atras", "armario"],
    ["tras", "armario"],

    ["conhece", "mario?"],
    ["conhece", "mario"],
    ["conhece", "mário"],
    ["quem", "mario"],
    ["quem", "mario?"],
    ["quem", "mário"],
    ["qual", "mario"],
    ["qual", "mario?"],
    ["qual", "mário"],
  ];

  const isMarioJoke = marioJokeTriggers.some((words) =>
    words.every((w) => normalized.includes(w))
  );

  if (isMarioJoke) {
    return (
      "😄 *Essa piada eu já conheço!* \n\n" +
      "✨ *Mas deixa eu te contar uma melhor:* \n\n" +
      "😂 *Por que o computador foi ao médico?* \n" +
      "👉 Porque ele estava com *vírus*! 😅💻\n\n" +
      "———\n" +
      "Agora falando sério 😉\n\n" +
      "📌 Em que posso te ajudar?\n" +
      "• Criar lembretes ⏰\n" +
      "• Listar seus lembretes 📋\n" +
      "• Excluir quando quiser 🗑️\n\n" +
      "É só me dizer ✨"
    );
  }

  if (normalized.includes("me lembra") || normalized.includes("me lembre")) {
    return "🧠 Entendi que você quer criar um lembrete, mas preciso da data ou horário certinho 😊";
  }

  // =========================
  // FALLBACK FINAL
  // =========================
  if (!normalized) {
    return (
      `${name}, Me desculpe, Não consegui entender. Reformule!, por exemplo: \n ` +
      "\n" +
      "*• amanhã às 17h30 ir para a academia*\n" +
      "*• listar lembretes*\n" +
      "*• excluir lembretes*\n"
    );
  }
}
