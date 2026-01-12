import { db } from "../firebase.js";
import { createDateBR } from "../utils/dateUtils.js";
import { Timestamp } from "firebase-admin/firestore";

// 🔧 Converte "DD-MM-YYYY" em Firestore Timestamp
function parseDateToTimestamp(dateStr, isEnd = false) {
  const [day, month, year] = dateStr.split("-").map(Number);

  const date = new Date(
    year,
    month - 1,
    day,
    isEnd ? 23 : 0,
    isEnd ? 59 : 0,
    isEnd ? 59 : 0,
    isEnd ? 999 : 0
  );

  return Timestamp.fromDate(date);
}

// ============================
// CRUD DE GASTOS
// ============================

export async function createExpense(userId, data) {
  await db
    .collection("gastos")
    .doc(userId)
    .collection("itens")
    .add({
      valor: data.valor,
      local: data.local,
      categoria: data.categoria,
      timestamp: data.timestamp ?? Timestamp.now(),
    });
}

// ============================
// HOJE
// ============================

export async function getTodayExpenses(userId) {
  const today = createDateBR();
  const snapshot = await db.ref(`gastos/${userId}`).once("value");

  let total = 0;

  snapshot.forEach((item) => {
    if (item.val().data === today) {
      total += item.val().valor;
    }
  });

  return total;
}

// ============================
// POR CATEGORIA
// ============================

export async function getExpensesByCategory(userId, categoria) {
  const snapshot = await db.ref(`gastos/${userId}`).once("value");

  let total = 0;

  snapshot.forEach((item) => {
    if (item.val().categoria === categoria) {
      total += item.val().valor;
    }
  });

  return total;
}

// ============================
// POR PERÍODO FIXO (DATA DIGITADA)
// ============================

export async function getExpensesByPeriod(userId, startDate, endDate) {
  const start = parseDateToTimestamp(startDate);
  const end = parseDateToTimestamp(endDate, true);

  const snapshot = await db
    .collection("gastos")
    .doc(userId)
    .collection("itens")
    .where("timestamp", ">=", start)
    .where("timestamp", "<=", end)
    .get();

  let total = 0;

  snapshot.forEach((doc) => {
    total += doc.data().valor;
  });

  return total;
}

// ============================
// PARCELAMENTO
// ============================

export async function criarGastoParcelado(userId, data) {
  const { valor_total, parcelas, descricao, categoria } = data;

  const valorParcela = Number((valor_total / parcelas).toFixed(2));
  const agora = new Date();

  for (let i = 0; i < parcelas; i++) {
    const dataParcela = new Date(agora);
    dataParcela.setMonth(dataParcela.getMonth() + i);

    await createExpense(userId, {
      valor: valorParcela,
      local: `${descricao} (${i + 1}/${parcelas})`,
      categoria,
      timestamp: Timestamp.fromDate(dataParcela),
    });
  }

  return (
    `💳 *Compra parcelada registrada com sucesso!*\n\n` +
    `📦 Item: ${descricao}\n` +
    `💰 Valor total: R$ ${valor_total.toFixed(2)}\n` +
    `🔢 Parcelas: ${parcelas}x de R$ ${(valor_total / parcelas).toFixed(
      2
    )}\n\n` +
    `📅 As parcelas foram distribuídas nos próximos ${parcelas} meses.`
  );
}

export async function getResumoGastos(userId, options = {}) {
  let inicio;
  let fim;

  // 🟢 CASO 1 — DATA EXATA (ex: fevereiro, dia X até Y)
  if (options.data_inicio && options.data_fim) {
    inicio = parseDateToTimestamp(options.data_inicio);
    fim = parseDateToTimestamp(options.data_fim, true);
  }

  // 🔵 CASO 2 — MÊS RELATIVO
  else if (options.periodo) {
    const hoje = new Date();

    if (options.periodo === "atual") {
      inicio = Timestamp.fromDate(
        new Date(hoje.getFullYear(), hoje.getMonth(), 1)
      );
      fim = Timestamp.fromDate(
        new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0, 23, 59, 59, 999)
      );
    }

    if (options.periodo === "proximo") {
      inicio = Timestamp.fromDate(
        new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1)
      );
      fim = Timestamp.fromDate(
        new Date(hoje.getFullYear(), hoje.getMonth() + 2, 0, 23, 59, 59, 999)
      );
    }

    if (options.periodo === "passado") {
      inicio = Timestamp.fromDate(
        new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1)
      );
      fim = Timestamp.fromDate(
        new Date(hoje.getFullYear(), hoje.getMonth(), 0, 23, 59, 59, 999)
      );
    }
  }

  // 🚨 PROTEÇÃO
  if (!inicio || !fim) {
    throw new Error("Parâmetros inválidos para resumo de gastos");
  }

  // 🔍 QUERY ÚNICA
  const snapshot = await db
    .collection("gastos")
    .doc(userId)
    .collection("itens")
    .where("timestamp", ">=", inicio)
    .where("timestamp", "<=", fim)
    .get();

  let total = 0;
  snapshot.forEach((doc) => {
    total += doc.data().valor;
  });

  return total;
}
