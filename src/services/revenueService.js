import { db } from "../config/firebase.js";
import { Timestamp } from "firebase-admin/firestore";

/**
 * 🔹 Lista receitas por período
 */
export async function getRevenuesByPeriod(userId, start, end) {
  const snap = await db
    .collection("users")
    .doc(userId)
    .collection("receitas")
    .where("userId", "==", userId)
    .where("createdAt", ">=", Timestamp.fromDate(start))
    .where("createdAt", "<=", Timestamp.fromDate(end))
    .orderBy("createdAt", "desc")
    .get();

  return snap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
}

/**
 * 🔹 Soma receitas por período
 */
export async function getTotalRevenuesByPeriod(userId, start, end) {
  const receitas = await getRevenuesByPeriod(userId, start, end);

  return receitas.reduce((sum, r) => sum + Number(r.valor || 0), 0);
}
