import { db } from "../firebase.js";
import { createDateBR, createHourBR } from "../utils/dateUtils.js";
import { Timestamp } from "firebase-admin/firestore";
import { parseBRL } from "../utils/moneyUtils.js";

// 🔧 Converte "DD-MM-YYYY" em Firestore Timestamp

export function parseDateToTimestamp(input, isEnd = false) {
  let date;

  // 1️⃣ Se já for Timestamp
  if (input instanceof Timestamp) {
    date = input.toDate();
  }
  // 2️⃣ Se já for Date
  else if (input instanceof Date) {
    date = input;
  }
  // 3️⃣ Se for string
  else if (typeof input === "string") {
    // formato DD-MM-YYYY
    if (input.includes("-") && input.split("-")[0].length === 2) {
      const [day, month, year] = input.split("-").map(Number);
      date = new Date(year, month - 1, day);
    }
    // formato YYYY-MM-DD (ISO simples)
    else if (input.includes("-")) {
      const [year, month, day] = input.split("-").map(Number);
      date = new Date(year, month - 1, day);
    } else {
      throw new Error("Formato de data inválido");
    }
  } else {
    throw new Error("Tipo de data inválido");
  }

  // 🔥 Ajuste de início / fim do dia (BR)
  if (isEnd) {
    date.setHours(23, 59, 59, 999);
  } else {
    date.setHours(0, 0, 0, 0);
  }

  return Timestamp.fromDate(date);
}

export async function createExpense(userId, data) {
  const valor = parseBRL(data.valor);

  if (valor === null) {
    throw new Error("Valor inválido para gasto");
  }

  await db.collection("users").doc(userId).collection("gastos").add({
    valor,
    local: data.local,
    categoria: data.categoria,
    timestamp: Timestamp.now(),
  });
}

export async function getTodayExpenses(userId) {
  const { inicio, fim } = getHojeRangeBR();

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

export async function getExpensesByPeriod(userId, startDate, endDate) {
  const start = parseDateToTimestamp(startDate);
  const end = parseDateToTimestamp(endDate, true);

  console.log("🔍 BUSCANDO:", { startDate, endDate });
  console.log("📅 start:", start.toDate());
  console.log("📅 end:", end.toDate());

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

export async function getExpensesDetailedByPeriod(
  phone,
  startDate,
  endDate,
  categoria = null,
) {
  let query = db
    .collection("gastos")
    .doc(phone)
    .collection("itens")
    .where("timestamp", ">=", startDate)
    .where("timestamp", "<=", endDate);

  if (categoria) {
    query = query.where("categoria", "==", categoria);
  }

  const snap = await query.get();

  return snap.docs.map((doc) => doc.data());
}

export async function criarGastoParcelado(userId, data) {
  const isPagamentoRecorrente =
    /emprestimo|financiamento|consorcio|credito|parcela do/i.test(
      data.descricao,
    );

  if (isPagamentoRecorrente && data.parcelas === 1) {
    // trata como gasto normal
  }

  // ⚠️ 1 parcela NÃO é compra parcelada
  if (data.parcelas === 1) {
    return await createExpense(userId, {
      valor: data.valor_total,
      local: data.descricao,
      categoria: data.categoria || "outros",
    }).then(() => {
      return (
        "💾 *Pagamento registrado com sucesso!*\n\n" +
        `📦 ${data.descricao}\n` +
        `💰 Valor: R$ ${Number(data.valor_total).toFixed(2)}`
      );
    });
  }

  const { parcelas, descricao, categoria } = data;

  const valorTotal = parseBRL(data.valor_total);

  if (!valorTotal || !parcelas) {
    throw new Error("Valor ou número de parcelas inválido");
  }

  const valorParcela = Number((valorTotal / parcelas).toFixed(2));

  const gastos = [];

  const agora = new Date(
    new Date().toLocaleString("en-US", {
      timeZone: "America/Sao_Paulo",
    }),
  );

  for (let i = 0; i < parcelas; i++) {
    const dataParcela = new Date(agora);
    dataParcela.setMonth(dataParcela.getMonth() + i);

    gastos.push({
      userId,
      valor: valorParcela,
      descricao: `${descricao} (${i + 1}/${parcelas})`,
      categoria,
      data: dataParcela.getTime(),
      recorrente: true,
      grupo_parcelado: `${descricao}-${agora.getTime()}`,
    });
  }

  // salvar todos no banco
  for (const gasto of gastos) {
    await createExpense(userId, {
      valor: gasto.valor,
      local: gasto.descricao, // ou "cartão de crédito"
      categoria: gasto.categoria,
    });
  }

  return (
    `💳 *Compra parcelada registrada com sucesso!*\n\n` +
    `📦 Item: ${descricao}\n` +
    `💰 Valor total: R$ ${valorTotal.toFixed(2)}\n` +
    `🔢 Parcelas: ${parcelas}x de R$ ${valorParcela.toFixed(2)}\n\n` +
    `📅 As parcelas foram distribuídas nos próximos ${parcelas} meses.`
  );
}

export async function getExpensesForAnalysis(
  phone,
  startDate,
  endDate,
  categoria = null,
) {
  const startTs = Timestamp.fromDate(startDate);
  const endTs = Timestamp.fromDate(endDate);

  console.log("🔎 BUSCANDO GASTOS");
  console.log("user:", phone);
  console.log("start:", startTs.toDate());
  console.log("end:", endTs.toDate());

  let query = db
    .collection("gastos")
    .doc(phone)
    .collection("itens")
    .where("timestamp", ">=", startTs)
    .where("timestamp", "<=", endTs);

  if (categoria) {
    query = query.where("categoria", "==", categoria);
  }

  const snap = await query.get();
  return snap.docs.map((d) => d.data());
}
