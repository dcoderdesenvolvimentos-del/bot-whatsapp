import { db } from "../firebase.js";

export async function getUser(user) {
  const ref = db.collection("users").doc(user);
  const snap = await ref.get();

  if (!snap.exists) {
    await ref.set({
      stage: "new",
      createdAt: Date.now(),
    });
    return { stage: "new" };
  }

  return snap.data();
}

export async function updateUser(id, data) {
  await db.collection("users").doc(id).set(data, { merge: true });
}

export async function saveUserName(userId, name) {
  await db.collection("users").doc(userId).set(
    {
      name,
      createdAt: Date.now(),
    },
    { merge: true }
  );
}

export async function getUserByPendingPayment(paymentId) {
  const snapshot = await db
    .collection("users")
    .where("pendingPayment", "==", paymentId)
    .limit(1)
    .get();

  if (snapshot.empty) return null;

  const doc = snapshot.docs[0];
  return { id: doc.id, ...doc.data() };
}
