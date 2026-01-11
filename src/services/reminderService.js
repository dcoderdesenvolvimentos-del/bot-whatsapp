import { db } from "../config/firebase.js";

export async function addReminder(phone, data) {
  console.log("🔥 Salvando lembrete:", phone, data);

  await db.collection("reminders").add({
    phone,
    text: data.text, // ← MUDOU DE action PARA text
    when: data.when, // ← MUDOU DE time PARA when
    sent: false,
    createdAt: Date.now(),
  });

  console.log("✅ Lembrete salvo no Firestore");
}

export async function getUserReminders(phone) {
  const now = Date.now();

  const snapshot = await db
    .collection("reminders")
    .where("phone", "==", phone)
    .where("sent", "==", false)
    .where("when", ">", now) // 🔥 ESSENCIAL
    .orderBy("when", "asc")
    .get();

  return snapshot;
}

export async function deleteUserReminder(phone, index) {
  const snapshot = await getUserReminders(phone);
  const reminders = snapshot.docs;

  if (reminders[index - 1]) {
    await db
      .collection("reminders")
      .doc(reminders[index - 1].id)
      .delete();
  }
}

export async function getPendingReminders() {
  const now = Date.now();

  const snapshot = await db
    .collection("reminders")
    .where("when", "<=", now) // ← MUDOU DE datetime PARA when
    .where("sent", "==", false)
    .get();

  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

export async function markAsSent(id) {
  await db.collection("reminders").doc(id).update({ sent: true });
}
