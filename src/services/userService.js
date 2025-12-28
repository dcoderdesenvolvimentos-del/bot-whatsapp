import { db } from "../firebase.js";

export async function updateUser(id, data) {
  await db.collection("users").doc(id).set(data, { merge: true });
}

export async function getUserByPendingPayment(paymentId) {
  const snap = await db
    .collection("users")
    .where("pendingPayment", "==", paymentId)
    .limit(1)
    .get();

  if (snap.empty) return null;

  const doc = snap.docs[0];
  return { id: doc.id, ...doc.data() };
}
