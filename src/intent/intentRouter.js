import { analyzeIntent } from "../ai/aiService.js";
import { createReminder } from "./createReminder.js";
import { listReminders } from "./listReminders.js";
import { deleteReminder } from "./deleteReminder.js";
import { createPixPayment } from "./mercadoPago.js";
import { getUser, updateUser } from "../services/userService.js";
import { INTENT_PROMPT } from "../ai/prompt.js";
import { showHelpMessage } from "../responses/helpResponse.js";
import { db } from "../config/firebase.js";
import { calcularPeriodo } from "./services/periodCalculator.js";

import {
  createList,
  addItemsToList,
  addItemsToSpecificList,
  removeItemsFromList,
  deleteList,
  getList,
  getAllLists,
} from "../services/shoppingListService.js";
import {
  createExpense,
  getTodayExpenses,
  getExpensesByCategory,
  encontrarAnoComGasto,
  criarGastoParcelado,
  getResumoGastos,
} from "../services/expenseService.js";

import { slugify, capitalize } from "../utils/textUtils.js";

/* ===========================
   HELPERS
========================= */

function normalize(text = "") {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function formatDateDMY(isoDate) {
  if (!isoDate) return "";
  const [year, month, day] = isoDate.split("-");
  return `${day}-${month}-${year}`;
}

/* =========================
   ROUTER PRINCIPAL
=========================  */

export async function routeIntent(userDocId, text) {
  console.log("🔥 routeIntent - userDocId:", userDocId);

  const MAPA_MESES = {
    janeiro: 1,
    fevereiro: 2,
    marco: 3,
    março: 3,
    abril: 4,
    maio: 5,
    junho: 6,
    julho: 7,
    agosto: 8,
    setembro: 9,
    outubro: 10,
    novembro: 11,
    dezembro: 12,
  };

  if (!userDocId) {
    console.error("❌ userDocId inválido");
    return "Erro ao identificar usuário.";
  }

  const normalized = normalize(text);

  /* =========================
     1️⃣ BUSCAR USUÁRIO
  ========================= */

  let userData = await getUser(userDocId);

  /* =========================
     2️⃣ PRIMEIRO CONTATO (ANTI-BAN)
  ========================= */

  if (!userData) {
    await updateUser(userDocId, {
      stage: "first_contact",
      messages: 1,
      createdAt: Date.now(),
    });

    return "Oi! 😊 Tudo bem com você?";
  }

  if (!userData.stage) {
    await updateUser(userDocId, { stage: "first_contact" });
    return "Oi! 😊 Tudo bem com você?";
  }

  /* =========================
     3️⃣ DELAY HUMANO
  ========================= */

  await new Promise((r) => setTimeout(r, 1500));

  /* =========================
     4️⃣ ONBOARDING POR STAGE
  ========================= */

  // 👉 Perguntar nome
  if (userData.stage === "first_contact") {
    await updateUser(userDocId, {
      stage: "awaiting_name",
      messages: (userData.messages || 1) + 1,
    });

    return "*👋 Antes de continuarmos, me diz seu nome?* 😊";
  }

  // 👉 Usuário respondeu o nome
  if (userData.stage === "awaiting_name") {
    const displayName =
      normalized.charAt(0).toUpperCase() + normalized.slice(1);

    await updateUser(userDocId, {
      stage: "confirming_name",
      tempName: displayName,
    });

    return (
      `✨ *Só confirmando rapidinho...*\n\n` +
      `👉 Seu nome é *${displayName}*?\n\n` +
      `Responda com:\n` +
      `✅ *sim* — confirmar\n` +
      `❌ *não* — corrigir`
    );
  }

  // 👉 Confirmar nome
  if (userData.stage === "confirming_name") {
    if (["sim", "isso", "correto", "pode ser"].includes(normalized)) {
      await updateUser(userDocId, {
        stage: "active",
        name: userData.tempName,
        tempName: null,
      });

      return (
        `✨ *Bem-vindo(a), ${userData.tempName}!* 😊\n\n` +
        `Agora eu cuido dos seus lembretes para que você possa focar no que importa ⏰✨\n\n` +
        `📌 *Você pode me pedir coisas como:*\n\n` +
        `• me lembra daqui 10 minutos\n` +
        `• amanhã às 17h30 ir para a academia\n` +
        `• listar lembretes\n` +
        `• excluir lembretes\n\n` +
        `🎤 Pode falar comigo por áudio ou texto, do jeito que preferir 😉`
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

    await updateUser(userDocId, {
      pendingPayment: pix.payment_id,
      pendingPlan: planKey,
    });

    return {
      type: "pix",
      text:
        "💳 *Pagamento via PIX - Copia e Cola*\n\n" +
        "⏳ Após pagamento confirmado, o plano ativa automaticamente 💎",
      pixCode: pix.pix_copia_e_cola,
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

  // =========================
  // AGRADECIMENTO
  // =========================
  if (
    [
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
    return "Por nada! 😊 qualquer coisa estou a disposição.";
  }

  /* =========================
     6️⃣ IA (SÓ USUÁRIO ATIVO)
  ========================= */

  if (userData.stage !== "active") {
    return "⚠️ Finalize seu cadastro antes de continuar 🙂";
  }

  function resolverPeriodoPorMes(mes) {
    const hoje = new Date();
    const mesAtual = hoje.getMonth() + 1;
    let ano = hoje.getFullYear();

    // se o mês já passou, assume o próximo ano
    if (mes < mesAtual) {
      ano += 1;
    }

    const mesStr = String(mes).padStart(2, "0");

    return {
      data_inicio: `${ano}-${mesStr}-01`,
      data_fim: `${ano}-${mesStr}-31`,
    };
  }

  try {
    const data = await analyzeIntent(normalizedFixed);
    let intent = data.intencao; // ✅ DECLARADO

    let response = "";

    function getDayRangeBR(date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);

      const end = new Date(date);
      end.setHours(23, 59, 59, 999);

      return {
        start: start.getTime(),
        end: end.getTime(),
      };
    }

    switch (intent) {
      case "AJUDA_GERAL":
        return showHelpMessage(userDocId);

      case "criar_lista": {
        const payload = data.data || {};
        const nomeLista = payload.nomeLista;
        const itens = payload.itens || [];

        if (!nomeLista) {
          return "❌ Qual o nome da lista?";
        }

        const listaId = await createList(userDocId, nomeLista);

        if (itens.length) {
          await addItemsToList(userDocId, listaId, itens);
        }

        return (
          `🛒 *LISTA: ${capitalize(nomeLista)}*\n` +
          "━━━━━━━━━━━━━━━━━━\n\n" +
          (itens.length
            ? itens.map((i) => `• ${i}`).join("\n")
            : "Lista criada vazia.") +
          "\n\n━━━━━━━━━━━━━━━━━━\n" +
          "💡 Você pode dizer:\n" +
          "• adicionar item\n" +
          "• listar listas"
        );
      }

      case "adicionar_item_lista": {
        const payload = data.data || {};
        const nomeLista = payload.nomeLista;
        const itens = payload.itens || [];

        if (!nomeLista || !itens.length) {
          return "❌ Diga o item e o nome da lista.";
        }

        const listaId = slugify(nomeLista);

        await addItemsToSpecificList(userDocId, listaId, itens);

        return (
          `🛒 *LISTA: ${capitalize(nomeLista)}*\n` +
          "━━━━━━━━━━━━━━━━━━\n\n" +
          "Itens adicionados:\n" +
          itens.map((i) => `• ${i}`).join("\n")
        );
      }

      case "remover_item_lista": {
        const payload = data.data || {};
        const nomeLista = payload.nomeLista;
        const itens = payload.itens || [];

        if (!nomeLista || !itens.length) {
          return "❌ Diga quais itens remover e de qual lista.";
        }

        const listaId = slugify(nomeLista);

        await removeItemsFromList(userDocId, listaId, itens);

        return (
          `🛒 *LISTA: ${capitalize(nomeLista)}*\n` +
          "━━━━━━━━━━━━━━━━━━\n\n" +
          "Itens removidos:\n" +
          itens.map((i) => `• ${i}`).join("\n")
        );
      }

      case "excluir_lista": {
        const payload = data.data || {};
        const nomeLista = payload.nomeLista;

        if (!nomeLista) {
          return "❌ Qual lista você quer excluir?";
        }

        const listaId = slugify(nomeLista);

        await deleteList(userDocId, listaId);

        return (
          "🗑️ *LISTA EXCLUÍDA*\n" +
          "━━━━━━━━━━━━━━━━━━\n\n" +
          `A lista *${capitalize(nomeLista)}* foi removida com sucesso.`
        );
      }

      case "listar_itens_lista": {
        const nomeLista =
          data.data?.nomeLista ||
          data.lista || // a IA está mandando assim
          null;

        if (!nomeLista) {
          return "❌ Qual lista você quer ver?";
        }

        const listaId = slugify(nomeLista);
        const lista = await getList(userDocId, listaId);

        if (!lista || !lista.items?.length) {
          return `🛒 A lista *${capitalize(
            nomeLista
          )}* está vazia ou não existe.`;
        }

        return (
          `🛒 *LISTA: ${capitalize(lista.nome)}*\n` +
          "━━━━━━━━━━━━━━━━━━\n\n" +
          lista.items
            .map((item, idx) => `• ${idx + 1}. ${item.name}`)
            .join("\n") +
          "\n\n━━━━━━━━━━━━━━━━━━"
        );
      }

      case "filtrar.gastos":
        const textoUsuario = request.body.queryResult.queryText;
        const periodo = calcularPeriodo(textoUsuario);

        if (!periodo) {
          return res.json({
            fulfillmentText:
              "Não entendi o período. Tenta: 'gastos desse mês' ou 'gastos de outubro'",
          });
        }

        const snapshot = await db
          .collection("gastos")
          .doc(userId)
          .collection("itens")
          .where("timestamp", ">=", periodo.inicio)
          .where("timestamp", "<=", periodo.fim)
          .get();

        if (snapshot.empty) {
          return res.json({
            fulfillmentText: `Nenhum gasto encontrado em ${periodo.descricao} 📭`,
          });
        }

        let total = 0;
        let lista = [];

        snapshot.forEach((doc) => {
          const d = doc.data();
          total += d.valor;
          lista.push(`• R$ ${d.valor.toFixed(2)} - ${d.local}`);
        });
        const resposta = `
📊 *Gastos de ${periodo.descricao}*

${lista.join("\n")}

💰 *Total: R$ ${total.toFixed(2)}*
  `.trim();

        return res.json({
          fulfillmentText: resposta,
        });

        break;

      case "criar_gasto_parcelado":
        return await criarGastoParcelado(userDocId, data);

      /* =========================
     6️⃣ Logica dos lembretes
  ========================= */

      // =====================================================
      // ⏰ CRIAR LEMBRETE(S)
      // =====================================================

      case "criar_lembrete":
        response = await createReminder(userDocId, data);
        break;

      case "listar_lembretes": {
        let start = null;
        let end = null;

        const now = new Date();

        // 📅 HOJE
        if (data.periodo === "hoje") {
          ({ start, end } = getDayRangeBR(now));
        }

        // 📅 AMANHÃ
        if (data.periodo === "amanha") {
          const d = new Date(now);
          d.setDate(d.getDate() + 1);
          ({ start, end } = getDayRangeBR(d));
        }

        // 📅 DIA ESPECÍFICO
        if (typeof data.dia === "number") {
          const d = new Date(now.getFullYear(), now.getMonth(), data.dia);
          ({ start, end } = getDayRangeBR(d));
        }

        // 📅 DIA DA SEMANA
        if (data.dia_semana) {
          const map = {
            domingo: 0,
            segunda: 1,
            terça: 2,
            quarta: 3,
            quinta: 4,
            sexta: 5,
            sábado: 6,
          };

          const alvo = map[data.dia_semana.toLowerCase()];
          const d = new Date(now);
          const diff = (alvo + 7 - d.getDay()) % 7;
          d.setDate(d.getDate() + diff);

          ({ start, end } = getDayRangeBR(d));
        }

        const query = db
          .collection("reminders")
          .where("phone", "==", userDocId)
          .where("when", ">", Date.now());

        if (start && end) {
          query.where("when", ">=", start).where("when", "<=", end);
        }

        const snapshot = await query.orderBy("when", "asc").get();

        if (snapshot.empty) {
          return "📭 Você não tem lembretes para esse período.";
        }

        let resposta = "🔔 Seus lembretes:\n\n";

        snapshot.docs.forEach((doc, i) => {
          const r = doc.data();
          const d = new Date(r.when).toLocaleString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          });

          resposta += `${i + 1}️⃣ ${d} — ${r.text}\n`;
        });

        return resposta;
      }

      case "excluir_lembrete":
        response = await deleteReminder(userDocId, data);
        break;

      case "saudacao":
        response =
          `👋 Olá, ${userData.tempName}!\n\n` +
          "Posso te ajudar com:\n" +
          "• criar lembretes\n" +
          "• listar lembretes\n" +
          "• excluir lembretes\n\n" +
          "Exemplo: *me lembra de comprar pão amanhã às 10h*";
        break;

      case "ajuda":
        response =
          "🤖 *Como usar?:*\n\n" +
          "• criar: me lembra de beber água daqui 10 minutos\n" +
          "• listar: listar lembretes\n" +
          "• excluir: apagar lembrete 1";
        break;

      case "despedida":
        response = `👋 Até mais, ${userData.tempName}! Estou aqui quando precisar 😊`;
        break;

      default:
        response =
          "🤔 Ops! Não entendi muito bem o que você quis dizer.\n\n" +
          "💡 Você pode tentar, por exemplo:\n\n" +
          "• me lembra de tomar agua amanhã às 14h\n" +
          "• criar uma lista de compras\n" +
          "• adicionar arroz na lista\n" +
          "• criar lembretes\n" +
          "• excluir lembretes\n" +
          "• listar lembretes";
    }

    return response;
  } catch (err) {
    console.error("❌ Erro na IA:", err);
    return "❌ Ops! Algo deu errado. Tente novamente.";
  }
}
