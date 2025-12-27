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

export async function updateUser(user, data) {
  await db.collection("users").doc(user).set(data, { merge: true });
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
