import { db } from "../config/firebase.js";

export async function getOrCreateUser({ phone }) {
  const userRef = db.collection("users").doc(phone);
  const doc = await userRef.get();

  if (!doc.exists) {
    await userRef.set({
      phone,
      createdAt: Date.now(),
      active: false,
      plan: "free",
    });
  }

  return userRef;
}

export async function getUser(phone) {
  const userRef = db.collection("users").doc(phone);
  const doc = await userRef.get();

  if (!doc.exists) {
    return null;
  }

  return doc.data();
}

export async function updateUser(phone, data) {
  const userRef = db.collection("users").doc(phone);
  await userRef.update(data);
}

export async function createUser(phone, data = {}) {
  const userRef = db.collection("users").doc(phone);
  await userRef.set({
    phone,
    createdAt: Date.now(),
    active: false,
    plan: "free",
    ...data,
  });
  return userRef;
}
