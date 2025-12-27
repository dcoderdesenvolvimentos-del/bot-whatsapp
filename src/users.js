import { db } from "./firebase.js";

export async function getUser(userId) {
  const doc = await db.collection("users").doc(userId).get();
  return doc.exists ? doc.data() : null;
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

export async function updateUser(user, data) {
  await db.collection("users").doc(user).set(data, { merge: true });
}
