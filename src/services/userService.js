import { db } from "../config/firebase.js";

export async function getUser(uid) {
  const userRef = db.collection("users").doc(uid);
  const doc = await userRef.get();

  if (!doc.exists) {
    return null;
  }

  return doc.data();
}

export async function updateUser(uid, data) {
  const userRef = db.collection("users").doc(uid);
  await userRef.update(data);
}

export async function createUser(uid, data = {}) {
  const userRef = db.collection("users").doc(uid);
  await userRef.set({
    phone,
    createdAt: Date.now(),
    active: false,
    plan: "free",
    ...data,
  });
  return userRef;
}
