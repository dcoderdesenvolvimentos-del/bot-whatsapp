import { db } from "../firebase.js";
import { createDateBR, createHourBR } from "../utils/dateUtils.js";

export async function createExpense(userId, data) {
  const ref = db.ref(`gastos/${userId}`).push();

  await ref.set({
    valor: data.valor,
    local: data.local,
    categoria: data.categoria,
    data: createDateBR(),
    hora: createHourBR(),
    timestamp: Date.now(),
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
  const snapshot = await db.ref(`gastos/${userId}`).once("value");

  const start = new Date(startDate + "T00:00:00").getTime();
  const end = new Date(endDate + "T23:59:59").getTime();

  let total = 0;

  snapshot.forEach((item) => {
    const ts = item.val().timestamp;
    if (ts >= start && ts <= end) {
      total += item.val().valor;
    }
  });

  return total;
}
