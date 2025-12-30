import { db } from "./config/firebase.js";

const COLLECTION = "reminders";

// 🔹 Adicionar lembrete
export async function addReminder(user, data) {
  if (!data?.text || !data?.when) {
    throw new Error("Tentativa de salvar lembrete inválido");
  }

  return db.collection("reminders").add({
    user,
    text: data.text,
    when: data.when, // ✅ único campo de data
    sent: false,
    createdAt: Date.now(),
  });
}

// 🔹 Listar lembretes do usuário
export async function listReminders(user) {
  const snapshot = await db
    .collection("reminders")
    .where("user", "==", user)
    .where("sent", "==", false)
    .orderBy("when", "asc")
    .get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
}

// 🔹 Buscar lembretes pendentes (scheduler)
export async function getPendingReminders() {
  const now = Date.now();

  const snap = await db
    .collection(COLLECTION)
    .where("sent", "==", false)
    .where("when", "<=", now)
    .get();

  return snap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
}

// 🔹 Marcar como enviado
export async function markAsSent(id) {
  await db.collection(COLLECTION).doc(id).update({
    sent: true,
  });
}

// 🔹 Deletar um lembrete
export async function deleteReminderByIndex(user, index) {
  const snapshot = await db
    .collection("reminders")
    .where("user", "==", user)
    .where("sent", "==", false)
    .orderBy("when")
    .get();

  const docs = snapshot.docs;

  if (index < 1 || index > docs.length) {
    return false;
  }

  const docToDelete = docs[index - 1];
  await docToDelete.ref.delete();

  return true;
}

// 🔹 Deletar todos os lembretes
export async function deleteAllReminders(user) {
  const snapshot = await db
    .collection("reminders")
    .where("user", "==", user)
    .where("sent", "==", false)
    .get();

  const batch = db.batch();

  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });

  await batch.commit();
  return snapshot.size;
}
