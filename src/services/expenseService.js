import { db } from "../firebase.js";
import { createDateBR, createHourBR } from "../utils/dateUtils.js";
import { Timestamp } from "firebase-admin/firestore";

export async function createExpense(userId, data) {
  await db.collection("gastos").doc(userId).collection("itens").add({
    valor: data.valor,
    local: data.local,
    categoria: data.categoria,
    timestamp: Timestamp.now(),
  });
}

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
  const start = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T23:59:59");

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

export async function criarGastoParcelado(userId, data) {
  const { valor_total, parcelas, descricao, categoria } = data;

  const valorParcela = Number((valor_total / parcelas).toFixed(2));

  const gastos = [];

  const agora = new Date();

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
    `💰 Valor total: R$ ${valor_total.toFixed(2)}\n` +
    `🔢 Parcelas: ${parcelas}x de R$ ${(valor_total / parcelas).toFixed(
      2
    )}\n\n` +
    `📅 As parcelas foram distribuídas nos próximos ${parcelas} meses.`
  );
}
