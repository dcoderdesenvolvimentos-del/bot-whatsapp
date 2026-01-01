import { db } from "../config/firebase.js";

export async function addReminder(phone, { text, when }) {
  await db.collection("reminders").add({
    phone: user, // 🔥 É AQUI. É ISSO.
    action: capitalizeFirst(data.acao),
    time: data.hora,
    sent: false,
    createdAt: Date.now(),
  });
}

export async function getUserReminders(phone) {
  const snapshot = await db
    .collection("reminders")
    .where("phone", "==", phone)
    .where("sent", "==", false)
    .orderBy("datetime", "asc")
    .get();

  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
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
