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
