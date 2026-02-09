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

export async function markAsSent(uid, reminderId, reminder) {
  const ref = db
    .collection("users")
    .doc(uid)
    .collection("reminders")
    .doc(reminderId);

  // 🔁 RECORRENTE → recalcula when
  if (reminder.recurring) {
    const nextWhen = calcularProximoWhen(reminder);

    return ref.update({
      when: nextWhen,
      sent: false,
    });
  }

  // 🔹 COMUM → marca como enviado
  return ref.update({ sent: true });
}

// 👇 stubs pra não quebrar imports antigos
export async function getUserReminders() {
  return [];
}
export async function deleteUserReminder() {}
export async function addRecurringReminder(uid, data) {
  if (!uid) {
    throw new Error("UID ausente ao criar lembrete recorrente");
  }

  if (!data?.mensagem || !data?.tipo_recorrencia || !data?.valor_recorrencia) {
    throw new Error("Dados inválidos para lembrete recorrente");
  }

  const recurring = {
    tipo: data.tipo_recorrencia, // mensal | semanal | diario | anual
    valor: data.valor_recorrencia, // ex: 10
  };

  const horario = data.horario || "00:00";

  const when = calcularPrimeiroWhen(recurring, horario);

  return db.collection("users").doc(uid).collection("reminders").add({
    text: data.mensagem,
    recurring,
    horario,
    when, // 🔥 PRÓXIMA EXECUÇÃO
    sent: false,
    createdAt: Date.now(),
  });
}

function calcularPrimeiroWhen(recurring, horario = "00:00") {
  const agora = new Date();
  const [h, m] = horario.split(":").map(Number);

  let when;

  if (recurring.tipo === "mensal") {
    when = new Date(
      agora.getFullYear(),
      agora.getMonth(),
      Number(recurring.valor),
      h,
      m,
    );

    if (when <= agora) {
      when.setMonth(when.getMonth() + 1);
    }
  }

  return Timestamp.fromDate(when);
}

function calcularProximoWhen(reminder) {
  if (!reminder.recurring) return null;

  const atual = reminder.when.toDate();
  const [h, m] = (reminder.horario || "00:00").split(":").map(Number);

  let next = new Date(atual);

  switch (reminder.recurring.tipo) {
    case "diario":
      next.setDate(next.getDate() + 1);
      break;
    case "semanal":
      next.setDate(next.getDate() + 7);
      break;
    case "mensal":
      next.setMonth(next.getMonth() + 1);
      break;
    case "anual":
      next.setFullYear(next.getFullYear() + 1);
      break;
  }

  next.setHours(h, m, 0, 0);
  return Timestamp.fromDate(next);
}
