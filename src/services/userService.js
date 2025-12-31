import { db } from "../config/firebase.js";

export async function getUser(userId) {
  if (!userId || typeof userId !== "string") return null;

  const snap = await db.collection("users").doc(userId).get();
  if (!snap.exists) return null;

  return snap.data();
}

export async function updateUser(userId, data) {
  if (!userId || typeof userId !== "string") return;

  await db
    .collection("users")
    .doc(userId)
    .set(
      {
        ...data,
        updatedAt: Date.now(),
      },
      { merge: true }
    );
}
