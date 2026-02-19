import { analyzeIntent } from "../ai/aiService.js";
import { createReminder } from "./createReminder.js";
import { deleteReminder } from "./deleteReminder.js";
import { createPixPayment } from "./mercadoPago.js";
import { getUser, updateUser } from "../services/userService.js";
import { showHelpMessage } from "../responses/helpResponse.js";
import { addRecurringReminder } from "../services/reminderService.js";
import { listarCompromissosPorPeriodo } from "../handlers/listarCompromissosPorPeriodo.js";
import { canUseReceipt } from "../services/receiptLimit.js";
import { parseReceiptText } from "../utils/receiptParser.js";
import { sendMessage } from "../zapi.js";
import { normalizeText } from "../utils/normalizeSpeech.js";
import { db } from "../config/firebase.js";

import {
  getRevenuesByPeriod,
  getTotalRevenuesByPeriod,
} from "../services/revenueService.js";
import { normalizeMoney } from "../utils/money.js";

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
  getExpensesByPeriod,
  criarGastoParcelado,
  getExpensesForAnalysis,
} from "../services/expenseService.js";

import { slugify, capitalize } from "../utils/textUtils.js";
import vision from "@google-cloud/vision";
import { parseBRL } from "../utils/moneyUtils.js";
import { Timestamp } from "firebase-admin/firestore";

const visionClient = new vision.ImageAnnotatorClient({
  credentials: JSON.parse(process.env.GOOGLE_VISION_CREDENTIALS),
});

console.log(
  "GOOGLE_VISION_CREDENTIALS exists?",
  !!process.env.GOOGLE_VISION_CREDENTIALS,
);

/* ==========================
   HELPERS
========================= */

function normalize(text = "") {
  if (typeof text !== "string") {
    if (text?.message && typeof text.message === "string") {
      text = text.message;
    } else {
      text = String(text ?? "");
    }
  }

  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function formatDateDMY(date) {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

function extractNameFromText(text = "") {
  if (!text || typeof text !== "string") return null;

  // 🔹 Normaliza texto
  let cleaned = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .trim();

  // 🔹 Remove frases comuns
  cleaned = cleaned
    .replace(/meu nome e/g, "")
    .replace(/me chamo/g, "")
    .replace(/eu sou/g, "")
    .replace(/sou o/g, "")
    .replace(/sou a/g, "")
    .replace(/nome e/g, "")
    .trim();

  // 🔹 Remove tudo que não for letra ou espaço
  cleaned = cleaned.replace(/[^a-zA-Z\s]/g, "").trim();

  if (!cleaned) return null;

  const words = cleaned.split(" ").filter((w) => w.length >= 2); // impede "a", "b"

  if (!words.length) return null;

  // 🔹 Impede risadas tipo kkk
  if (words.join("").match(/^(k)+$/)) return null;

  // 🔹 Limita a até 3 nomes
  const limited = words.slice(0, 3);

  // 🔹 Capitaliza corretamente
  const formatted = limited
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");

  return formatted;
}

/* =========================
   ROUTER PRINCIPAL
=========================  */

export async function routeIntent(userDocId, text, media = {}) {
  console.log("🔥 routeIntent - userDocId:", userDocId);

  // Transforma a data do OCR em Timestamp real antes de salvar
  function buildDateFromReceipt(dataStr, horaStr) {
    if (!dataStr || typeof dataStr !== "string") {
      return null;
    }

    let day, month, year;

    // aceita DD-MM-YYYY
    if (dataStr.includes("-")) {
      [day, month, year] = dataStr.split("-").map(Number);
    }

    // aceita DD/MM/YYYY
    if (dataStr.includes("/")) {
      [day, month, year] = dataStr.split("/").map(Number);
    }

    if (!day || !month || !year) {
      return null;
    }

    let h = 12;
    let m = 0;

    if (horaStr && typeof horaStr === "string" && horaStr.includes(":")) {
      const [hh, mm] = horaStr.split(":").map(Number);
      if (!isNaN(hh)) h = hh;
      if (!isNaN(mm)) m = mm;
    }

    const date = new Date(year, month - 1, day, h, m);

    // 🔒 validação final
    if (isNaN(date.getTime())) {
      return null;
    }

    return date;
  }

  function buildDateFromText(dataStr, horaStr) {
    if (!dataStr || typeof dataStr !== "string") {
      return null;
    }

    let day, month, year;

    // aceita 24-01-2026
    if (dataStr.includes("-")) {
      [day, month, year] = dataStr.split("-").map(Number);
    }

    // aceita 24/01/2026
    if (dataStr.includes("/")) {
      [day, month, year] = dataStr.split("/").map(Number);
    }

    // se só veio dia (ex: "24"), usa mês/ano atual
    if (/^\d{1,2}$/.test(dataStr)) {
      const now = new Date();
      day = Number(dataStr);
      month = now.getMonth() + 1;
      year = now.getFullYear();
    }

    if (!day || !month || !year) {
      return null;
    }

    let h = 12;
    let m = 0;

    if (horaStr && horaStr.includes(":")) {
      const [hh, mm] = horaStr.split(":").map(Number);
      if (!isNaN(hh)) h = hh;
      if (!isNaN(mm)) m = mm;
    }

    const date = new Date(year, month - 1, day, h, m);
    return isNaN(date.getTime()) ? null : date;
  }

  if (!userDocId) {
    console.error("❌ userDocId inválido");
    return "Erro ao identificar usuário.";
  }

  /* =========================
     1️⃣ BUSCAR USUÁRIO (ANTES DE TUDO)
  ========================= */

  const userData = await getUser(userDocId);

  if (!userData) {
    console.error("❌ Usuário não encontrado:", userDocId);
    return "Erro ao carregar seus dados. Tente novamente.";
  }

  // 👻 USUÁRIO AINDA NÃO FALOU DE VERDADE
  if (userData.stage === "ghost") {
    await updateUser(userDocId, {
      stage: "first_contact",
      messages: 1,
    });

    return "Oi! 😊 Tudo bem com você?";
  }

  const normalized = normalize(text);

  /* =========================
   1️⃣ BUSCAR USUÁRIO
========================= */

  /* =========================
   2️⃣ PRIMEIRO CONTATO (ANTI-BAN)
   ⚠️ REGRA: respondeu → encerra
========================= */

  /* =========================
   3️⃣ ONBOARDING POR STAGE
========================= */

  // 👉 Perguntar nome (SEGUNDA mensagem)
  if (userData.stage === "first_contact") {
    await updateUser(userDocId, {
      stage: "awaiting_name",
      messages: (userData.messages || 1) + 1,
    });

    return "*👋 Antes de continuarmos, me diz seu nome?* 😊";
  }

  // 👉 Usuário respondeu o nome
  if (userData.stage === "awaiting_name") {
    const extractedName = extractNameFromText(text);

    if (!extractedName) {
      return "Não consegui entender seu nome 🤔 Pode me dizer novamente?";
    }

    const displayName = extractedName;

    await updateUser(userDocId, {
      stage: "confirming_name",
      tempName: displayName,
    });

    return {
      type: "buttons",
      text: `✨ *Só confirmando rapidinho...*\n\n👉 Seu nome é *${displayName}*?`,
      buttons: [
        { id: "sim", text: "✅ Sim" },
        { id: "nao", text: "❌ Não" },
      ],
    };
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
        `Eu sou o *Mário*, seu assistente pessoal de finanças e compromissos 📊⏰\n\n` +
        `A partir de agora eu cuido dos seus:\n` +
        `💰 Gastos\n` +
        `💵 Receitas\n` +
        `📆 Compromissos/Lembretes\n` +
        `🛒 Listas de compras\n` +
        `📈 Resumos e análises financeiras\n\n` +
        `━━━━━━━━━━━━━━\n` +
        `📌 *Você pode me pedir coisas como:*\n\n` +
        `🔔 COMPROMISSOS/LEMBRETES\n` +
        `• me lembra daqui 10 minutos\n` +
        `• amanhã às 17h ir para a academia\n` +
        `• listar meus lembretes\n` +
        `• excluir lembrete\n\n` +
        `💰 GASTOS\n` +
        `• gastei 50 reais na padaria\n` +
        `• quanto gastei hoje?\n` +
        `• resumo dos meus gastos do mês\n` +
        `• em qual categoria eu mais gastei?\n\n` +
        `💵 RECEITAS\n` +
        `• recebi 1500 do cliente\n` +
        `• quanto eu recebi esse mês?\n` +
        `• qual meu saldo?\n\n` +
        `🛒 LISTAS DE COMPRAS\n` +
        `• criar lista de supermercado\n` +
        `• adicionar arroz na lista\n` +
        `• me mostra minhas listas\n\n` +
        `📊 *Dashboard Online*\n` +
        `Você também pode acompanhar tudo pelo seu painel:\n` +
        `👉 https://app.marioai.com.br/m/${userData.dashboardSlug}\n\n` +
        `Lá você vê gráficos, histórico completo e controle total das suas finanças 📈\n\n` +
        `🎤 Pode falar comigo por áudio ou texto.\n` +
        `Bora organizar sua vida? 🚀`
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
   4️⃣ DELAY HUMANO (SÓ USUÁRIO ATIVO)
========================= */

  if (userData.stage === "active") {
    await new Promise((r) => setTimeout(r, 1500));
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
    (_, h) => `${Number(h) + 12}h`,
  );

  // "8h da tarde" → "20h"
  fixed = fixed.replace(
    /(\d{1,2})h\s*da\s*tarde/g,
    (_, h) => `${Number(h) + 12}h`,
  );

  // usa o texto corrigido
  const normalizedFixed = fixed;

  // =========================
  // AGRADECIMENTO
  // =========================
  if (
    [
      "muito obrigado",
      "top",
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

  // =========================
  // SAUDAÇÃO
  // =========================
  if (
    [
      ".",
      ",",
      "/",
      "oi",
      "ola",
      "olá",
      "boa noite",
      "bom dia",
      "boa tarde",
      "mario",
      "oi mario",
      "ola mario",
      "opa",
      "op",
      "criar lembrete",
      "oi mario tudo bem?",
      "ola mario tudo bem?",
      "ola mario tudo joia",
      "ei",
      "ei mario",
      "oba",
      "fala campeão",
      "iae campeão",
    ].includes(text)
  ) {
    return (
      `✨ *Olá, ${userData.name}!* 😊\n\n` +
      `POSSO TE AJUDAR COM:\n` +
      `💰 Gastos\n` +
      `💵 Receitas\n` +
      `📆 Compromissos/Lembretes\n` +
      `🛒 Listas de compras\n` +
      `📈 Resumos e análises financeiras\n\n` +
      `━━━━━━━━━━━━━━\n` +
      `📌 *Você pode me pedir coisas como:*\n\n` +
      `🔔 COMPROMISSOS/LEMBRETES\n` +
      `• me lembra daqui 10 minutos\n` +
      `• amanhã às 17h ir para a academia\n` +
      `• listar meus lembretes\n` +
      `• excluir lembrete\n\n` +
      `💰 GASTOS\n` +
      `• gastei 50 reais na padaria\n` +
      `• quanto gastei hoje?\n` +
      `• resumo dos meus gastos do mês\n` +
      `• em qual categoria eu mais gastei?\n\n` +
      `💵 RECEITAS\n` +
      `• recebi 1500 do cliente\n` +
      `• quanto eu recebi esse mês?\n` +
      `• qual meu saldo?\n\n` +
      `🛒 LISTAS DE COMPRAS\n` +
      `• criar lista de supermercado\n` +
      `• adicionar arroz na lista\n` +
      `• me mostra minhas listas\n\n` +
      `📊 *Dashboard Online*\n` +
      `Você também pode acompanhar tudo pelo seu painel:\n` +
      `👉 https://app.marioai.com.br/m/${userData.dashboardSlug}\n\n` +
      `Lá você vê gráficos, histórico completo e controle total das suas finanças 📈\n\n` +
      `🎤 Pode falar comigo por áudio ou texto.\n` +
      `Bora organizar sua vida? 🚀`
    );
  }

  /* =========================
     6️⃣ IA (SÓ USUÁRIO ATIVO)
  ========================= */

  if (userData.stage !== "active") {
    return "⚠️ Finalize seu cadastro antes de continuar 🙂";
  }

  /* =========================
   📸 COMPROVANTE (IMAGEM)
========================= */

  if (media?.hasImage && media.imageUrl) {
    console.log("📸 IMAGEM RECEBIDA NO ROUTER:", media.imageUrl);
    return await handleReceiptFlow(userDocId, media.imageUrl);
  }

  /* =========================
   🔘 COMANDOS DIRETOS (BOTÕES)
========================= */

  if (normalized === "cancelar_comprovante") {
    await updateUser(userDocId, { tempReceipt: null });
    return "❌ Comprovante descartado. Nenhum gasto foi salvo.";
  }

  if (normalized === "confirmar_salvar_comprovante") {
    const user = await getUser(userDocId);

    if (!user?.tempReceipt) {
      return "⚠️ Nenhum comprovante pendente para salvar.";
    }

    const dados = user.tempReceipt;

    // 🔥 AQUI É O PONTO CRÍTICO 🔥
    const date = buildDateFromReceipt(dados.data, dados.hora);

    const timestamp = date
      ? Timestamp.fromDate(date) // data REAL do gasto
      : Timestamp.now(); // fallback (se OCR falhar)

    await createExpense(userDocId, {
      valor: dados.valor,
      local: dados.local,
      categoria: "outros",

      timestamp, // ✅ PASSANDO PARA O BANCO
      createdAt: Timestamp.now(), // quando foi cadastrado
    });

    await updateUser(userDocId, { tempReceipt: null });

    return (
      "💾 *Gasto salvo com sucesso!*\n\n" +
      `💰 R$ ${dados.valor.toFixed(2)}\n` +
      `📅 Data: ${dados.data || "Hoje"}`
    );
  }

  try {
    const data = await analyzeIntent(normalizedFixed);
    let intent = data.intencao; // ✅ DECLARADO

    let response = "";

    if (data.valor_total) {
      data.valor_total = parseBRL(data.valor_total);
    }

    function parseDateDMYorISO(input) {
      // Se já for Date, retorna direto
      if (input instanceof Date) return input;

      // Se não for string, erro
      if (typeof input !== "string") {
        throw new Error("Data inválida");
      }

      // Formato DD-MM-YYYY
      if (input.includes("-") && input.split("-")[0].length === 2) {
        const [day, month, year] = input.split("-").map(Number);
        return new Date(year, month - 1, day);
      }

      // Formato YYYY-MM-DD
      if (input.includes("-")) {
        const [year, month, day] = input.split("-").map(Number);
        return new Date(year, month - 1, day);
      }

      throw new Error("Formato de data inválido");
    }

    function startOfDay(date) {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      return d;
    }

    function endOfDay(date) {
      const d = new Date(date);
      d.setHours(23, 59, 59, 999);
      return d;
    }

    function extractRelativeMonthFromText(text = "") {
      const now = new Date();

      // tenta capturar "dia 21"
      const matchDia = text.match(/dia\s+(\d{1,2})/i);
      const dia = matchDia ? Number(matchDia[1]) : now.getDate();

      // mês passado
      if (/m[eê]s passado/i.test(text)) {
        return new Date(now.getFullYear(), now.getMonth() - 1, dia, 12, 0, 0);
      }

      // mês retrasado
      if (/m[eê]s retrasado/i.test(text)) {
        return new Date(now.getFullYear(), now.getMonth() - 2, dia, 12, 0, 0);
      }

      // esse mês
      if (/esse m[eê]s/i.test(text)) {
        return new Date(now.getFullYear(), now.getMonth(), dia, 12, 0, 0);
      }

      return null;
    }

    function resolveDateFromTextForReceita(text = "") {
      return (
        extractExplicitDateFromText(text) || // 👈 20 de janeiro
        extractRelativeMonthFromText(text) || // mês passado dia 21
        extractRelativeDateFromText(text) || // ontem / hoje
        new Date()
      );
    }

    function extractExplicitDateFromText(text = "") {
      const meses = {
        janeiro: 0,
        fevereiro: 1,
        março: 2,
        marco: 2,
        abril: 3,
        maio: 4,
        junho: 5,
        julho: 6,
        agosto: 7,
        setembro: 8,
        outubro: 9,
        novembro: 10,
        dezembro: 11,
      };

      const regex =
        /dia\s+(\d{1,2})\s+de\s+(janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)/i;

      const match = text.toLowerCase().match(regex);
      if (!match) return null;

      const dia = Number(match[1]);
      const mes = meses[match[2]];

      const now = new Date();
      let ano = now.getFullYear();

      // se o mês já passou este ano, mantém
      // se ainda não chegou, assume ano passado
      if (mes > now.getMonth()) {
        ano -= 1;
      }

      return new Date(ano, mes, dia, 12, 0, 0);
    }

    function extractMoneyFromText(text = "") {
      if (!text) return null;

      const normalized = text
        .toLowerCase()
        .replace(/\./g, "")
        .replace(",", ".");

      /**
       * REGRA:
       * - contexto monetário OBRIGATÓRIO
       * - número vem DEPOIS do contexto
       * - impede capturar "dia 20", "20 de janeiro"
       */
      const moneyRegex = /\b(?:r\$|reais?|real)\s*(\d{1,5}(?:\.\d{2})?)\b/g;

      let match;
      const valores = [];

      while ((match = moneyRegex.exec(normalized)) !== null) {
        const numero = Number(match[1]);
        if (!isNaN(numero) && numero > 0) {
          valores.push(numero);
        }
      }

      // nenhum valor válido
      if (!valores.length) return null;

      // se tiver mais de um, pega o PRIMEIRO (mais seguro que Math.max)
      return valores[0];
    }

    switch (intent) {
      case "contratar_premium":
        return (
          "💎 Ative o Mário Premium agora:\n\n" +
          "https://pay.hotmart.com/SEULINK"
        );

      case "registrar_receita": {
        console.log("💰 Registrando receita:", data);
        console.log("🧠 TEXTO ORIGINAL:", text);

        let valor = null;

        /* =====================================================
     1️⃣ PRIORIDADE → VALOR DA IA
  ===================================================== */
        if (typeof data.valor === "number" && data.valor > 0) {
          valor = data.valor;
        }

        /* =====================================================
     2️⃣ TEXTO / ÁUDIO → EXTRAÇÃO SEGURA
     (IGNORA DIA 20, 21 etc)
  ===================================================== */
        const valorTexto = extractMoneyFromText(text);

        if (valorTexto && valorTexto > 0) {
          // Se a IA errar feio (ex: 5000 quando falou 50), confia no texto
          if (!valor || valor >= valorTexto * 10) {
            valor = valorTexto;
          }
        }

        /* =====================================================
     3️⃣ CORREÇÃO DE ERRO CLÁSSICO DE ÁUDIO (STT)
     "cinquenta reais" → 5000 ❌
  ===================================================== */
        if (
          valor >= 1000 &&
          !/mil|milhares/i.test(text) &&
          !String(valor).includes(".")
        ) {
          console.warn("⚠️ Correção STT aplicada:", valor, "→", valor / 100);
          valor = valor / 100;
        }

        /* =====================================================
     4️⃣ VALIDAÇÃO FINAL
  ===================================================== */
        if (!valor || isNaN(valor) || valor <= 0) {
          return (
            "🤔 Não consegui identificar o valor da receita.\n\n" +
            "👉 Exemplo: *recebi 50 reais do cliente João*"
          );
        }

        /* =====================================================
     5️⃣ DATA — MESMA LÓGICA DO GASTO (SEM INVENTAR)
  ===================================================== */
        let createdAt = Timestamp.now();

        // data explícita: "dia 20 de janeiro"
        const dataResolvida = resolveDateFromTextForReceita(text);

        if (dataResolvida && !isNaN(dataResolvida.getTime())) {
          createdAt = Timestamp.fromDate(dataResolvida);
        }

        /* =====================================================
     6️⃣ SALVA NO FIREBASE
  ===================================================== */
        await criarReceita({
          userId: userDocId,
          valor,
          descricao: data.descricao || "Recebimento",
          origem: data.origem || "não informado",
          date: createdAt.toDate(),
        });

        /* =====================================================
     7️⃣ RESPOSTA AO USUÁRIO
  ===================================================== */

        return (
          "💰 *Receita registrada com sucesso!*\n\n" +
          `💵 Valor: ${Number(valor).toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
          })}\n` +
          `📌 Origem: ${data.origem || "não informada"}\n` +
          `📅 Data: ${createdAt.toDate().toLocaleDateString("pt-BR")}`
        );
      }

      case "consultar_receitas_periodo": {
        const { data_inicio, data_fim } = data;

        let start, end;

        if (data_inicio && data_fim) {
          start = parseDateDMYorISO(data_inicio);
          end = parseDateDMYorISO(data_fim);
          end.setHours(23, 59, 59, 999);
        } else {
          ({ start, end } = getCurrentMonthRange());
        }

        const receitas = await getRevenuesByPeriod(userDocId, start, end);

        if (!receitas.length) {
          return "📭 Você não teve nenhuma receita nesse período.";
        }

        let total = 0;
        let resposta = "💰 *Receitas do período*\n\n";

        for (const r of receitas) {
          total += Number(r.valor);

          resposta +=
            `• ${r.descricao || "Receita"}\n` +
            `  📅 ${r.createdAt.toDate().toLocaleDateString("pt-BR")}\n` +
            `  💵 ${Number(r.valor).toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            })}\n\n`;
        }

        resposta += `💰 *Total recebido:* ${total.toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        })}`;

        return resposta.trim();
      }

      case "consultar_saldo": {
        const { data_inicio, data_fim } = data;

        let start, end;

        if (data_inicio && data_fim) {
          start = parseDateDMYorISO(data_inicio);
          end = parseDateDMYorISO(data_fim);
          end.setHours(23, 59, 59, 999);
        } else {
          ({ start, end } = getCurrentMonthRange());
        }

        const totalReceitas = await getTotalRevenuesByPeriod(
          userDocId,
          start,
          end,
        );

        const totalGastos = await getExpensesByPeriod(userDocId, start, end);

        const saldo = totalReceitas - totalGastos;

        const emoji = saldo >= 0 ? "🟢" : "🔴";

        return (
          `${emoji} *Saldo do período*\n\n` +
          `💰 Entradas: ${totalReceitas.toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
          })}\n` +
          `💸 Saídas: ${totalGastos.toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
          })}\n\n` +
          `📊 *Saldo atual:* ${saldo.toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
          })}\n` +
          "━━━━━━━━━━━━━━\n" +
          `📊 *Dashboard Online*\n` +
          `Você também pode acompanhar tudo pelo seu painel:\n` +
          `👉 https://app.marioai.com.br/m/${userData.dashboardSlug}\n\n` +
          `Lá você vê gráficos, histórico completo e controle total das suas finanças 📈\n\n`
        );
      }

      case "registrar_gasto_comprovante":
        return (
          "📸 Pode enviar a *foto do comprovante* agora.\n\n" +
          "Eu identifico o valor, a data e salvo o gasto automaticamente 💾"
        );

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
          "✨ *O que você pode fazer agora:*\n\n" +
          "➕ *Adicionar itens*\n" +
          "Ex: _“adicionar arroz e feijão na lista compras do mês”_\n\n" +
          "➖ *Remover itens*\n" +
          "Ex: _“remover arroz da lista compras do mês”_\n\n" +
          "🗑️ *Excluir lista*\n" +
          "Ex: _“excluir lista compras do mês”_\n\n" +
          "📄 *Ver itens da lista*\n" +
          "Ex: _“ver lista compras do mês”_\n" +
          "━━━━━━━━━━━━━━\n" +
          `📊 *Dashboard Online*\n` +
          `Você também pode acompanhar tudo pelo seu painel:\n` +
          `👉 https://app.marioai.com.br/m/${userData.dashboardSlug}\n\n`
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

      case "listar_todas_listas": {
        const listas = await getAllLists(userDocId);

        if (!listas || listas.length === 0) {
          const userSnap = await db.collection("users").doc(userDocId).get();
          const { phone } = userSnap.data() || {};

          if (!phone) return;

          return await sendMessage(
            phone,
            "📭 Você ainda não tem nenhuma lista criada.",
          );
        }

        // 🔹 busca o usuário
        const userSnap = await db.collection("users").doc(userDocId).get();
        const { phone, dashboardSlug } = userSnap.data() || {};

        if (!phone) return;

        const link = dashboardSlug
          ? `https://app.marioai.com.br/m/${dashboardSlug}`
          : null;

        let resposta = "📋 *Suas listas de compras*\n\n";

        listas.forEach((lista, index) => {
          resposta += `${index + 1}️⃣ 🛒 *${capitalize(lista.nome)}*\n`;
        });

        resposta +=
          "\n──────────────\n" +
          "✨ *O que você pode fazer agora:*\n\n" +
          "➕ *Adicionar itens*\n" +
          "Ex: _“adicionar arroz e feijão na lista compras do mês”_\n\n" +
          "➖ *Remover itens*\n" +
          "Ex: _“remover arroz da lista compras do mês”_\n\n" +
          "🗑️ *Excluir lista*\n" +
          "Ex: _“excluir lista compras do mês”_\n\n" +
          "📄 *Ver itens da lista*\n" +
          "Ex: _“ver lista compras do mês”_\n";
        "━━━━━━━━━━━━━━\n" +
          +`📊 *Dashboard Online*\n` +
          `Você também pode acompanhar tudo pelo seu painel:\n` +
          `👉 https://app.marioai.com.br/m/${userData.dashboardSlug}\n\n`;

        if (link) {
          resposta += `\n\n📊 *Ver tudo no dashboard:*\n${link}`;
        }

        return await sendMessage(phone, resposta);
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
            nomeLista,
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

      case "limpar_lista":
        await clearShoppingList(userDocId);
        return "🧹 Sua lista de compras foi limpa!";

      /* =========================
     Logica Dos Gastos
  ========================= */

      /* Salva Gastos */

      case "criar_gasto": {
        console.log("🧠 IA payload:", data);
        console.log("🧠 TEXTO ORIGINAL:", text);

        let rawValor = data.valor;

        // 🔒 Fallback regex (caso IA não retorne valor)
        if (!rawValor) {
          const cleanText = removeDatePartsFromText(text);

          const match = cleanText.match(
            /(r\$|\$)?\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)/i,
          );

          if (match) {
            rawValor = match[2];
          }
        }

        if (!rawValor) {
          return "🤔 Não consegui identificar o valor do gasto.";
        }

        // 🔥 NORMALIZAÇÃO DEFINITIVA
        let valorNormalizado = String(rawValor)
          .replace(/\./g, "") // remove separador de milhar
          .replace(",", "."); // vírgula vira ponto decimal

        valorNormalizado = parseFloat(valorNormalizado);

        if (isNaN(valorNormalizado)) {
          return "❌ Valor inválido.";
        }

        const { local, categoria } = data;

        // 📅 TRATAMENTO DE DATA
        let date = null;

        // 1️⃣ Data explícita da IA
        if (data.data) {
          date = buildDateFromText(data.data, data.hora);
        }

        // 2️⃣ Mês relativo (mês passado, etc)
        if (!date) {
          date = extractRelativeMonthFromText(text);
        }

        // 3️⃣ Dia relativo (ontem, hoje, etc)
        if (!date) {
          date = extractRelativeDateFromText(text);
        }

        const timestamp = date ? Timestamp.fromDate(date) : Timestamp.now();

        // 💾 SALVA
        await createExpense(userDocId, {
          valor: valorNormalizado, // salva como número real
          local: local || "não informado",
          categoria: categoria || "outros",
          timestamp,
          createdAt: Timestamp.now(),
        });

        // 🔗 DASHBOARD LINK
        const userSnap = await db.collection("users").doc(userDocId).get();
        const { dashboardSlug } = userSnap.data() || {};

        const link = dashboardSlug
          ? `https://app.marioai.com.br/m/${dashboardSlug}`
          : null;

        return (
          "💾 *Gasto salvo com sucesso!*\n\n" +
          `💰 Valor:  ${valorNormalizado.toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
          })}\n` +
          `📍 Local: ${capitalize(local || "não informado")}\n` +
          `📅 Data: ${date ? date.toLocaleDateString("pt-BR") : "Hoje"}` +
          (link ? `\n\n📊 *Ver no dashboard:*\n${link}` : "")
        );
      }

      /* Gastos do Dia */
      case "consultar_gasto_dia": {
        const total = await getTodayExpenses(userDocId);

        return `💸 Hoje você gastou *R$ ${total.toFixed(2)}*`;
      }

      /* Gastos por Categoria */
      case "consultar_gasto_categoria": {
        const { categoria } = data;

        if (!categoria) {
          return "🤔 Qual categoria? Ex: quanto gastei no supermercado?";
        }

        const total = await getExpensesByCategory(userDocId, categoria);

        return `🏷️ ${categoria}\n💰 Total gasto: *R$ ${total.toFixed(2)}*`;
      }

      /* Gastos por Periodo */
      case "consultar_gasto_periodo": {
        const { data_inicio, data_fim } = data;

        if (!data_inicio || !data_fim) {
          return "🤔 Não consegui entender o período.";
        }

        // 🔥 CONVERSÃO ÚNICA AQUI
        const inicio = parseDateDMYorISO(data_inicio);
        const fim = parseDateDMYorISO(data_fim);

        const total = await getExpensesByPeriod(userDocId, inicio, fim);

        return (
          "📆 *Resumo de gastos*\n\n" +
          `🗓️ De ${formatDateDMY(inicio)} até ${formatDateDMY(fim)}\n` +
          `💰 Total gasto: *${Number(total).toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
          })}*\n` +
          "━━━━━━━━━━━━━━\n" +
          `📊 *Dashboard Online*\n` +
          `Você também pode acompanhar tudo pelo seu painel:\n` +
          `👉 https://app.marioai.com.br/m/${userData.dashboardSlug}\n\n`
        );
      }

      case "consultar_gasto_detalhado": {
        const { data_inicio, data_fim, categoria, analise } = data;

        if (!data_inicio || !data_fim) {
          return "🤔 Não consegui entender o período.";
        }

        const inicio = startOfDay(parseDateDMYorISO(data_inicio));
        const fim = endOfDay(parseDateDMYorISO(data_fim));

        const gastos = await getExpensesForAnalysis(
          userDocId,
          inicio,
          fim,
          categoria,
        );

        if (!gastos.length) {
          return "📭 Não encontrei gastos nesse período.";
        }

        // 🔥 AQUI É ONDE AS FUNÇÕES PASSAM A FUNCIONAR 🔥

        if (analise === "categoria_mais_gasto") {
          const [cat, total] = categoriaMaisGasto(gastos);
          return (
            `📂 *Categoria que você mais gastou:*\n\n` +
            `👉 *${cat}* — ${total.toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            })}\n` +
            "━━━━━━━━━━━━━━\n" +
            `📊 *Dashboard Online*\n` +
            `Você também pode acompanhar tudo pelo seu painel:\n` +
            `👉 https://app.marioai.com.br/m/${userData.dashboardSlug}\n\n`
          );
        }

        if (analise === "dia_mais_gasto") {
          const [dia, total] = diaMaisGasto(gastos);
          return (
            `📅 *Dia do mês que você mais gastou:*\n\n` +
            `👉 Dia *${dia}* — ${total.toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            })}\n` +
            "━━━━━━━━━━━━━━\n" +
            `📊 *Dashboard Online*\n` +
            `Você também pode acompanhar tudo pelo seu painel:\n` +
            `👉 https://app.marioai.com.br/m/${userData.dashboardSlug}\n\n`
          );
        }

        if (analise === "dia_semana_mais_gasto") {
          const [dia, total] = diaSemanaMaisGasto(gastos);
          return (
            `📆 *Dia da semana que você mais gastou:*\n\n` +
            `👉 *${dia}* — ${total.toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            })}`
          );
        }

        if (analise === "menor_gasto") {
          const g = menorGasto(gastos);

          return (
            `🪙 *Seu menor gasto no período foi:*\n\n` +
            `📅 ${formatDateDMY(g.timestamp.toDate())}\n` +
            `📍 ${g.local}\n` +
            `💰 ${Number(g.valor).toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            })}` +
            (g.categoria ? ` (${g.categoria})` : "")
          );
        }

        // 🔹 PADRÃO: LISTA DETALHADA
        let total = 0;
        let resposta = "🧾 *Gastos detalhados*\n\n";

        for (const g of gastos) {
          total += Number(g.valor);

          resposta +=
            `• ${formatDateDMY(g.timestamp.toDate())}\n` +
            `  📍 ${g.local}\n` +
            `  💰 ${Number(g.valor).toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            })}` +
            (g.categoria ? ` (${g.categoria})` : "") +
            `\n\n`;
        }

        resposta += `💰 *Total:* ${total.toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        })}\n`;
        "━━━━━━━━━━━━━━\n" +
          +`📊 *Dashboard Online*\n` +
          `Você também pode acompanhar tudo pelo seu painel:\n` +
          `👉 https://app.marioai.com.br/m/${userData.dashboardSlug}\n\n`;

        return resposta.trim();
      }

      case "consultar_gasto_por_texto": {
        const { data_inicio, data_fim, texto_busca, categoria } = data;

        if (!texto_busca) {
          return "🤔 Qual gasto você quer procurar? Ex: Uber, mercado, cinema.";
        }

        const inicio = startOfDay(parseDateDMYorISO(data_inicio));
        const fim = endOfDay(parseDateDMYorISO(data_fim));

        const gastos = await getExpensesForAnalysis(
          userDocId,
          inicio,
          fim,
          categoria,
        );

        const termo = normalizeText(texto_busca);

        const filtrados = gastos.filter((g) =>
          normalizeText(g.local || "").includes(termo),
        );

        if (!filtrados.length) {
          return `📭 Não encontrei gastos com *${texto_busca}* nesse período.`;
        }

        let total = 0;
        let resposta = `🔍 *Gastos com "${texto_busca}"*\n\n`;

        for (const g of filtrados) {
          total += Number(g.valor);

          resposta +=
            `• ${formatDateDMY(g.timestamp.toDate())}\n` +
            `  📍 ${g.local}\n` +
            `  💰 ${Number(g.valor).toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            })}\n\n`;
        }

        resposta += `💰 *Total:* ${total.toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        })}`;

        return resposta.trim();
      }

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

      case "criar_lembrete_recorrente":
        const tiposTexto = {
          diario: "todos os dias",
          semanal: `toda ${data.valor_recorrencia}`,
          mensal: `todo dia ${data.valor_recorrencia}`,
          anual: `todo dia ${data.valor_recorrencia}`,
        };

        await addRecurringReminder(userDocId, data);

        response =
          `✅ *Lembrete recorrente criado!*\n\n` +
          `📝 ${data.mensagem}\n` +
          `🔁 Frequência: ${tiposTexto[data.tipo_recorrencia]}\n` +
          `⏰ Horário: ${data.horario}`;
        break;

      case "LISTAR_COMPROMISSOS_POR_PERIODO": {
        return await listarCompromissosPorPeriodo({
          userId: userDocId,
          periodo: data.periodo,
          userName: userData.name,
        });
      }

      case "excluir_lembrete":
        response = await deleteReminder(userDocId, data);
        break;

      case "saudacao":
        response =
          `👋 Olá, ${userData.name}!\n\n` +
          "Eu sou o *Mário*, seu assistente pessoal de finanças e compromissos 📊⏰\n\n" +
          "Posso te ajudar com:\n\n" +
          "🔔 *Lembretes*\n" +
          "• me lembra de comprar pão amanhã às 10h\n" +
          "• daqui 20 minutos me lembrar de ligar para o cliente\n\n" +
          "💰 *Controle de gastos*\n" +
          "• gastei 50 reais na padaria\n" +
          "• quanto gastei hoje?\n\n" +
          "💵 *Receitas e saldo*\n" +
          "• recebi 1500 do cliente\n" +
          "• qual meu saldo?\n\n" +
          "🛒 *Listas de compras*\n" +
          "• criar lista de supermercado\n" +
          "• adicionar arroz na lista\n\n" +
          "━━━━━━━━━━━━━━\n" +
          "📊 Você também pode acompanhar tudo pelo seu dashboard:\n" +
          `👉 https://app.marioai.com.br/m/${userData.dashboardSlug}\n\n` +
          "🎤 Pode falar comigo por áudio ou texto 😉";
        break;

      case "ajuda":
        response =
          "🤖 *Como usar o Mário?*\n\n" +
          "━━━━━━━━━━━━━━\n" +
          "🔔 *COMPROMISSOS/LEMBRETES*\n" +
          "• me lembra de beber água daqui 10 minutos\n" +
          "• amanhã às 18h ir para a academia\n" +
          "• listar meus lembretes\n" +
          "• excluir lembrete 1\n\n" +
          "━━━━━━━━━━━━━━\n" +
          "💰 *GASTOS*\n" +
          "• gastei 50 reais na padaria\n" +
          "• quanto gastei hoje?\n" +
          "• resumo dos meus gastos do mês\n" +
          "• em qual categoria eu mais gastei?\n\n" +
          "━━━━━━━━━━━━━━\n" +
          "💵 *RECEITAS*\n" +
          "• recebi 1500 do cliente\n" +
          "• quanto recebi esse mês?\n" +
          "• qual meu saldo?\n\n" +
          "━━━━━━━━━━━━━━\n" +
          "🛒 *LISTAS DE COMPRAS*\n" +
          "• criar lista de supermercado\n" +
          "• adicionar arroz na lista\n" +
          "• me mostra minhas listas\n\n" +
          "━━━━━━━━━━━━━━\n" +
          "📊 *Dashboard Online*\n" +
          "Acompanhe tudo por aqui:\n" +
          `👉 https://app.marioai.com.br/m/${userData.dashboardSlug}\n\n` +
          "🎤 Você pode falar comigo por áudio ou texto 😉";
        break;

      case "despedida":
        response = `👋 Até mais, ${userData.name}! Estou aqui quando precisar 😊`;
        break;

      default:
        response =
          "🤔 Hmm... não consegui entender muito bem o que você quis dizer.\n\n" +
          "Mas calma 😄 eu posso te ajudar com:\n\n" +
          "━━━━━━━━━━━━━━\n" +
          "🔔 *LEMBRETES*\n" +
          "• me lembra de tomar água amanhã às 14h\n" +
          "• daqui 30 minutos me lembrar de ligar para o cliente\n" +
          "• listar meus lembretes\n\n" +
          "━━━━━━━━━━━━━━\n" +
          "💰 *GASTOS*\n" +
          "• gastei 50 reais na padaria\n" +
          "• quanto gastei hoje?\n" +
          "• resumo dos meus gastos do mês\n\n" +
          "━━━━━━━━━━━━━━\n" +
          "🛒 *LISTAS DE COMPRAS*\n" +
          "• criar lista de supermercado\n" +
          "• adicionar arroz na lista\n" +
          "• me mostra minhas listas\n\n" +
          "Se quiser, digite *ajuda* para ver tudo o que posso fazer 😉";
    }

    return response;
  } catch (err) {
    console.error("❌ Erro na IA:", err);
    return "❌ Ops! Algo deu errado. Tente novamente.";
  }
}

/* =========================
   📸 COMPROVANTE — FUNÇÕES AUXILIARES
========================= */
async function handleReceiptFlow(userId, imageUrl) {
  console.log("📸 Processando comprovante:", imageUrl);

  const allowed = await canUseReceipt(userId, 30);
  if (!allowed) {
    return (
      "📸 Você atingiu o limite de *30 comprovantes neste mês*.\n\n" +
      "🔄 O limite será renovado automaticamente no próximo mês 🙂"
    );
  }

  const ocrText = await runOCR(imageUrl);

  if (!ocrText) {
    return (
      "⚠️ Não consegui identificar texto nesse comprovante.\n\n" +
      "📸 Tente enviar uma foto mais nítida ou um print do comprovante."
    );
  }

  console.log("🧾 TEXTO EXTRAÍDO PELO OCR:\n", ocrText);

  const dados = parseReceiptText(ocrText);

  if (!dados.valor) {
    return "⚠️ Não consegui identificar o valor do comprovante.";
  }

  // 🔹 salva temporariamente no usuário
  await updateUser(userId, {
    tempReceipt: dados,
  });

  // 🔹 AQUI entra a CONFIRMAÇÃO
  return {
    type: "buttons",
    text:
      "💳 *Comprovante identificado*\n\n" +
      `📍 Local: ${dados.local}\n` +
      `📅 Data: ${dados.data || "não identificada"}\n` +
      `⏰ Horário: ${dados.hora || "não identificado"}\n` +
      `💰 Valor: R$ ${dados.valor.toFixed(2)}\n\n` +
      "Deseja salvar esse gasto?",
    buttons: [
      { id: "confirmar_salvar_comprovante", text: "✅ Salvar" },
      { id: "cancelar_comprovante", text: "❌ Cancelar" },
    ],
  };
}

async function runOCR(imageUrl) {
  const [result] = await visionClient.textDetection(imageUrl);
  return result.fullTextAnnotation?.text || "";
}

function categoriaMaisGasto(gastos) {
  const mapa = {};
  for (const g of gastos) {
    const cat = g.categoria || "outros";
    mapa[cat] = (mapa[cat] || 0) + Number(g.valor);
  }
  return Object.entries(mapa).sort((a, b) => b[1] - a[1])[0];
}

function diaMaisGasto(gastos) {
  const mapa = {};
  for (const g of gastos) {
    const dia = g.timestamp.toDate().getDate();
    mapa[dia] = (mapa[dia] || 0) + Number(g.valor);
  }
  return Object.entries(mapa).sort((a, b) => b[1] - a[1])[0];
}

const DIAS = [
  "domingo",
  "segunda",
  "terça",
  "quarta",
  "quinta",
  "sexta",
  "sábado",
];

function diaSemanaMaisGasto(gastos) {
  const mapa = {};
  for (const g of gastos) {
    const d = g.timestamp.toDate().getDay();
    const nome = DIAS[d];
    mapa[nome] = (mapa[nome] || 0) + Number(g.valor);
  }
  return Object.entries(mapa).sort((a, b) => b[1] - a[1])[0];
}

function menorGasto(gastos) {
  let menor = null;

  for (const g of gastos) {
    if (!menor || Number(g.valor) < Number(menor.valor)) {
      menor = g;
    }
  }

  return menor;
}

function extractDateFromRawText(text = "") {
  const match = text.match(/dia\s+(\d{1,2})/i);
  if (!match) return null;

  const day = Number(match[1]);
  if (!day || day > 31) return null;

  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), day, 12, 0);
}

function extractRelativeDateFromText(text = "") {
  const now = new Date();

  if (/anteontem/i.test(text)) {
    now.setDate(now.getDate() - 2);
    return now;
  }

  if (/ontem/i.test(text)) {
    now.setDate(now.getDate() - 1);
    return now;
  }

  if (/hoje/i.test(text)) {
    return now;
  }

  return null;
}

async function criarReceita({ userId, valor, descricao, origem, date }) {
  if (!valor || isNaN(valor) || valor <= 0) {
    throw new Error("Valor da receita inválido");
  }

  const receita = {
    userId,
    valor: Number(valor),
    descricao: descricao || "Receita",
    origem: origem || "não informado",
    tipo: "receita",
    createdAt: date ? Timestamp.fromDate(date) : Timestamp.now(),
  };

  await db.collection("users").doc(userId).collection("receitas").add(receita);

  // 🔥 BUSCA O USUÁRIO CORRETAMENTE
  const userSnap = await db.collection("users").doc(userId).get();
  const user = userSnap.data();

  const link = user?.dashboardSlug
    ? `https://app.marioai.com.br/m/${user.dashboardSlug}`
    : null;

  console.log("✅ Receita salva com data correta:\n", receita);

  return (
    "💰 *Receita registrada com sucesso!*\n\n" +
    `💵 Valor: ${Number(valor).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    })}\n` +
    `🏷 Origem: ${origem || "Não informado"}` +
    (link ? `\n\n📊 Ver no dashboard:\n${link}` : "")
  );
}

function getCurrentMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  return { start, end };
}
