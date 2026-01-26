import { db } from "../firebase.js";
import { nowUTC } from "../utils/dateUtils.js";
import { Timestamp } from "firebase-admin/firestore";

const COLLECTION = "reminders";

export async function addReminder(phone, { text, when }) {
  return db.collection(COLLECTION).add({
    phone,
    text,
    when, // 🔥 SEMPRE timestamp UTC
    sent: false,
    createdAt: nowUTC(),
  });
}

export async function getPendingReminders() {
  const now = Timestamp.now();

  const snap = await db
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
