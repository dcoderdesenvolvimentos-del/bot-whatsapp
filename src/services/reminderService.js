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
    .where("when", ">", now) // 🔥 ÚNICO CRITÉRIO DE PENDENTE
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
  const doc = await db.collection("reminders").doc(id).get();
  const lembrete = doc.data();

  // Se for recorrente, reagenda
  if (lembrete.recorrente) {
    await reagendarRecorrente(id, lembrete);
  } else {
    // Se for único, marca como enviado
    await db.collection("reminders").doc(id).update({ sent: true });
  }
}

// 📅 Calcula próxima data de recorrência
function calcularProximaRecorrencia(tipo, valor, horario) {
  const agora = new Date();
  const [hour, minute] = horario.split(":").map(Number);

  let proxima = new Date();
  proxima.setHours(hour, minute, 0, 0);

  switch (tipo) {
    case "diario":
      // Se já passou hoje, agenda para amanhã
      if (proxima <= agora) {
        proxima.setDate(proxima.getDate() + 1);
      }
      break;

    case "semanal":
      const diasSemana = {
        domingo: 0,
        segunda: 1,
        terca: 2,
        quarta: 3,
        quinta: 4,
        sexta: 5,
        sabado: 6,
      };
      const diaAlvo = diasSemana[valor.toLowerCase()];
      const diaAtual = proxima.getDay();

      let diasAte = diaAlvo - diaAtual;
      if (diasAte <= 0 || (diasAte === 0 && proxima <= agora)) {
        diasAte += 7;
      }
      proxima.setDate(proxima.getDate() + diasAte);
      break;

    case "mensal":
      const dia = parseInt(valor);
      proxima.setDate(dia);

      // Se já passou esse mês, vai pro próximo
      if (proxima <= agora) {
        proxima.setMonth(proxima.getMonth() + 1);
      }
      break;

    case "anual":
      const [diaAnual, mesAnual] = valor.split("-").map(Number);
      proxima.setMonth(mesAnual - 1);
      proxima.setDate(diaAnual);

      // Se já passou esse ano, vai pro próximo
      if (proxima <= agora) {
        proxima.setFullYear(proxima.getFullYear() + 1);
      }
      break;
  }

  return proxima.getTime();
}

// 🔔 Adicionar lembrete RECORRENTE
export async function addRecurringReminder(phone, data) {
  console.log("🔥 Salvando lembrete recorrente:", phone, data);

  const proximaData = calcularProximaRecorrencia(
    data.tipo_recorrencia,
    data.valor_recorrencia,
    data.horario
  );

  await db.collection("reminders").add({
    phone,
    text: data.mensagem,
    when: proximaData,
    sent: false,
    createdAt: Date.now(),
    recorrente: true,
    tipo_recorrencia: data.tipo_recorrencia,
    valor_recorrencia: data.valor_recorrencia,
    horario: data.horario,
  });

  console.log("✅ Lembrete recorrente salvo");
}

// 🔁 Reagendar lembrete recorrente após ser enviado
export async function reagendarRecorrente(lembreteId, lembrete) {
  console.log("🔁 Reagendando lembrete recorrente:", lembreteId);

  const proximaData = calcularProximaRecorrencia(
    lembrete.tipo_recorrencia,
    lembrete.valor_recorrencia,
    lembrete.horario
  );

  // Atualiza o lembrete existente
  await db.collection("reminders").doc(lembreteId).update({
    when: proximaData,
    sent: false,
  });

  console.log("✅ Lembrete reagendado para:", new Date(proximaData));
}
