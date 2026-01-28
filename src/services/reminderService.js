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

  const usersSnap = await db.collection("users").get();

  const reminders = [];

  for (const userDoc of usersSnap.docs) {
    const uid = userDoc.id;

    const snap = await db
      .collection("users")
      .doc(uid)
      .collection("reminders")
      .where("sent", "==", false)
      .where("when", "<=", now)
      .get();

    snap.forEach((doc) => {
      reminders.push({
        id: doc.id,
        uid,
        ...doc.data(),
      });
    });
  }

  console.log("🔔 Lembretes encontrados:", reminders.length);
  return reminders;
}

export async function markAsSent(uid, reminderId) {
  return db
    .collection("users")
    .doc(uid)
    .collection("reminders")
    .doc(reminderId)
    .update({ sent: true });
}

// 👇 stubs pra não quebrar imports antigos
export async function getUserReminders() {
  return [];
}
export async function deleteUserReminder() {}
export async function addRecurringReminder() {}
