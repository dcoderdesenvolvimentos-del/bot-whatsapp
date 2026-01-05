import { db } from "../config/firebase.js";

export async function getOrCreateUser({ phone }) {
  const userRef = db.collection("users").doc(phone);
  const doc = await userRef.get();

  if (!doc.exists) {
    await userRef.set({
      phone,
      createdAt: new Date(),
      active: true,
    });
  }

  return userRef;
}
