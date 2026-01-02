import { db } from "../config/firebase.js";

export async function addReminder(phone, data) {
  console.log("🔥 Salvando lembrete:", phone, action, time);
  await db.collection("reminders").add({
    phone, // ✅ agora existe
    action: data.action,
    time: data.time,
    sent: false,
    createdAt: Date.now(),
  });
  console.log("✅ Lembrete salvo no Firestore");
}

export async function getUserReminders(phone) {
  if (!phone) {
    throw new Error("Phone não informado em getUserReminders");
  }

  return db
    .collection("reminders")
    .where("phone", "==", phone)
    .where("sent", "==", false)
    .get();
}

export async function deleteUserReminder(phone, index) {
  const reminders = await getUserReminders(phone);

  if (reminders[index - 1]) {
    await db
      .collection("reminders")
      .doc(reminders[index - 1].id)
      .delete();
  }
}

export async function getPendingReminders() {
  const now = new Date().toISOString();
  const snapshot = await db
    .collection("reminders")
    .where("datetime", "<=", now)
    .where("sent", "==", false)
    .get();

  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

export async function markAsSent(id) {
  await db.collection("reminders").doc(id).update({ sent: true });
}
