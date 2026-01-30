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
import { handleGastoPorNotificacao } from "../handlers/gastoNotificacao.js";
import { extrairTextoDaImagem } from "../services/vision.js";

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

  /* =========================
   📸 INTERCEPTAÇÃO DE IMAGEM (PRIMEIRO DE TUDO)
========================= */

  if (media?.hasImage && media.imageUrl) {
    console.log("📸 IMAGEM INTERCEPTADA NO TOPO:", media.imageUrl);

    const textoOCRRaw = await extrairTextoDaImagem(media.imageUrl);

    console.log("🧾 OCR BRUTO:\n", textoOCRRaw);

    const ocr = textoOCRRaw
      .toUpperCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    // 🚨 REGRA ABSOLUTA: NUBANK = NOTIFICAÇÃO
    if (ocr.includes("NUBANK")) {
      console.log("🚨 NOTIFICAÇÃO BANCÁRIA (NUBANK) — BLOQUEANDO COMPROVANTE");

      return await handleGastoPorNotificacao({
        userDocId,
        imagem: media.imageUrl,
        textoOCR: textoOCRRaw,
      });
    }

    // 🧾 SOMENTE SE NÃO FOR NOTIFICAÇÃO
    console.log("🧾 IMAGEM SEM NUBANK → COMPROVANTE");
    return await handleReceiptFlow(userDocId, media.imageUrl);
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
    const displayName =
      normalized.charAt(0).toUpperCase() + normalized.slice(1);

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
        `Agora eu cuido dos seus lembretes para que você possa focar no que importa ⏰✨\n\n` +
        `📌 *Você pode me pedir coisas como:*\n\n` +
        `• me lembra daqui 10 minutos\n` +
        `• amanhã às 17h30 ir para a academia\n` +
        `• listar lembretes\n` +
        `• excluir lembretes\n\n` +
        `🎤 Pode falar comigo por áudio ou texto 😉`
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
      `Oi! 😊 Posso fazer muito por você.\n\n` +
      "Exemplos:\n" +
      "*• me lembra daqui 10 minutos*\n" +
      "*• amanhã às 17h30 ir para a academia*\n" +
      "*• listar lembretes*\n" +
      "*• adicionar um gasto*\n" +
      "*• listar gastos, do dia, mes ou ano.*\n" +
      "*• Ex: Me lembre todo dia 5 de pagar internet*\n" +
      "\n" +
      "📋 É só digitar ou gravar um áudio que eu anoto tudo certinho para não esquecer!"
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

  /* =========================
   📸 IMAGEM (NOTIFICAÇÃO OU COMPROVANTE)
========================= */

  /* =========================
   📸 IMAGEM (FORÇAR NOTIFICAÇÃO)
========================= */

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

    switch (intent) {
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
          "Ex: _“ver lista compras do mês”_"
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
          return await sendMessage(
            userDocId,
            "📭 Você ainda não tem nenhuma lista criada.",
          );
        }

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
          "Ex: _“ver lista compras do mês”_";

        return await sendMessage(userDocId, resposta);
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

      case "registrar_gasto_por_notificacao":
        await handleGastoPorNotificacao(payload);
        break;

      case "criar_gasto": {
        console.log("🧠 IA payload:", data);
        console.log("🧠 TEXTO ORIGINAL:", text);

        let rawValor = data.valor;

        // 🔥 SE A IA DEVOLVEU NUMBER, tenta extrair do texto original
        if (typeof rawValor === "number") {
          const match = text.match(/r?\$?\s*(\d{1,5})/i);
          if (match) {
            rawValor = match[1]; // string "3200"
          }
        }

        const { local, categoria } = data;

        if (!rawValor) {
          return "🤔 Não consegui identificar o valor do gasto.";
        }

        let date = null;

        // 1️⃣ data explícita da IA
        if (data.data) {
          date = buildDateFromText(data.data, data.hora);
        }

        // 2️⃣ data relativa do texto (ontem, hoje…)
        if (!date) {
          date = extractRelativeDateFromText(text);
        }

        // 3️⃣ fallback absoluto
        const timestamp = date ? Timestamp.fromDate(date) : Timestamp.now();

        await createExpense(userDocId, {
          valor: rawValor,
          local,
          categoria: categoria || "outros",
          timestamp,
          createdAt: Timestamp.now(),
        });

        return (
          "💾 *Gasto salvo com sucesso!*\n\n" +
          `💰 Valor: R$ ${data.valor}\n` +
          `📍 Local: ${capitalize(local)}\n` +
          `📅 Data: ${date ? date.toLocaleDateString("pt-BR") : "hoje"}`
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
          })}*`
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
            })}`
          );
        }

        if (analise === "dia_mais_gasto") {
          const [dia, total] = diaMaisGasto(gastos);
          return (
            `📅 *Dia do mês que você mais gastou:*\n\n` +
            `👉 Dia *${dia}* — ${total.toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            })}`
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
        })}`;

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

// src/handlers/handleBotao.js

globalThis.userSession ??= {};

export async function handleBotao(payload) {
  const session = globalThis.userSession[payload.phone];
  if (!session) return;

  // ✅ CONFIRMAR GASTO ÚNICO
  if (payload.buttonId === "confirmar_gasto") {
    const gasto = session.gasto;

    await salvarGasto({
      valor: gasto.valor,
      estabelecimento: gasto.estabelecimento,
      origem: "notificacao_bancaria",
      criado_em: new Date(), // data do registro, NÃO da compra
    });

    delete globalThis.userSession[payload.phone];
    await sendMessage(payload.phone, "✅ Gasto registrado com sucesso!");
    return;
  }

  // ❌ CANCELAR
  if (payload.buttonId === "cancelar_gasto") {
    delete globalThis.userSession[payload.phone];
    await sendMessage(payload.phone, "❌ Registro cancelado.");
    return;
  }

  // 📲 ESCOLHA MÚLTIPLA
  if (payload.buttonId.startsWith("escolher_gasto_")) {
    const index = Number(payload.buttonId.split("_").pop());
    const gasto = session.gastos[index];

    await salvarGasto({
      valor: gasto.valor,
      estabelecimento: gasto.estabelecimento,
      origem: "notificacao_bancaria",
      criado_em: new Date(),
    });

    delete globalThis.userSession[payload.phone];
    await sendMessage(payload.phone, "✅ Gasto registrado com sucesso!");
    return;
  }
}
