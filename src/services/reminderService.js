import { db } from "../firebase.js";
import { nowUTC } from "../utils/dateUtils.js";
import { Timestamp } from "firebase-admin/firestore";

const COLLECTION = "reminders";

export async function addReminder(uid, data) {
  if (!uid) {
    throw new Error("UID ausente ao criar lembrete");
  }

  if (!data?.text || !data?.when) {
    throw new Error("Tentativa de salvar lembrete inválido");
  }

  return db.collection("users").doc(uid).collection("reminders").add({
    text: data.text,
    when: data.when,
    sent: false,
    createdAt: Date.now(),
  });
}

export async function getPendingReminders() {
  const now = Timestamp.now();

  const snap = await db
    .collection("users")
    .doc(uid)
    .collection("reminders")
    .where("sent", "==", false)
    .where("when", "<=", now)
    .get();

  console.log("🔔 Lembretes encontrados:", snap.size);

  return snap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
}

export async function markAsSent(id) {
  await db.collection(COLLECTION).doc(id).update({
    sent: true,
  });
}

// 👇 stubs pra não quebrar imports antigos
export async function getUserReminders() {
  return [];
}
export async function deleteUserReminder() {}
export async function addRecurringReminder() {}
