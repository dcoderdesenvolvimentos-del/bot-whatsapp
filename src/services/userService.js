import { db } from "../firebase.js";

export async function getUser(userId) {
  if (!userId || typeof userId !== "string") {
    console.error("❌ userId inválido:", userId);
    return null;
  }

  const ref = db.collection("users").doc(userId);
  const snap = await ref.get();

  if (!snap.exists) return null;

  return snap.data();
}

export async function updateUser(userId, data) {
  if (!userId || typeof userId !== "string") {
    console.error("❌ userId inválido:", userId);
    return;
  }

  const ref = db.collection("users").doc(userId);

  await ref.set(
    {
      ...data,
      updatedAt: Date.now(),
    },
    { merge: true }
  );
}
