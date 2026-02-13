import { db } from "../firebase.js";
import { Timestamp } from "firebase-admin/firestore";

function startOfTodayBR() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function startOfDayFromTimestampBR(timestamp) {
  const d = new Date(timestamp);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function startOfDay(dateStr) {
  return new Date(dateStr + "T00:00:00").getTime();
}

function endOfDay(dateStr) {
  return new Date(dateStr + "T23:59:59").getTime();
}

export async function listarCompromissosPorPeriodo({
  userId,
  periodo,
  userName,
}) {
  if (!periodo?.data_inicio || !periodo?.data_fim) {
    return "⚠️ Não consegui identificar o período dos compromissos.";
  }

  const startDate = new Date(periodo.data_inicio + "T00:00:00");
  const endDate = new Date(periodo.data_fim + "T23:59:59");

  const start = Timestamp.fromDate(startDate);
  const end = Timestamp.fromDate(endDate);

  const snapshot = await db
    .collection("users")
    .doc(userId)
    .collection("reminders")
    .get();

  let lista = [];

  snapshot.forEach((doc) => {
    const l = doc.data();

    const when = l.when.toDate();

    const isRecurring =
      typeof l.recurring === "object" && typeof l.recurring?.tipo === "string";

    const base = {
      id: doc.id,
      text: l.text,
      when,
      isRecurring,
      recurrence: isRecurring ? l.recurring : null,
    };

    const ocorrencias = gerarOcorrenciasBackend(base);

    ocorrencias.forEach((o) => {
      if (o.data >= startDate && o.data <= endDate) {
        lista.push(o);
      }
    });
  });

  if (snapshot.empty) {
    return "📭 Você não tem compromissos nesse período.";
  }

  const nome = userName ? ` ${userName}` : "";
  const periodoLabel = getPeriodoLabel(periodo);

  let resposta = `📅 *Olá${nome}, aqui estão seus compromissos ${periodoLabel}:*\n\n`;

  // 👇 COLOQUE ISSO AQUI
  const hojeInicioBR = startOfTodayBR();
  const agora = Date.now();
  const LIMITE_MS = 6 * 60 * 60 * 1000; // 6h

  let lastDate = null;

  snapshot.forEach((doc) => {
    const r = doc.data();

    const whenDate = r.when.toDate();
    const inicioDiaCompromissoBR = startOfDayFromTimestampBR(
      whenDate.getTime(),
    );

    // ❌ REGRA 1 — mês/semana: não mostrar dias anteriores a hoje
    if (inicioDiaCompromissoBR < hojeInicioBR) {
      return;
    }

    // ❌ REGRA 2 — HOJE: respeita limite de 6h
    if (inicioDiaCompromissoBR === hojeInicioBR && r.when < agora - LIMITE_MS) {
      return;
    }

    const dataObj = r.when.toDate();

    const data = dataObj.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
    });

    const diaSemana = dataObj.toLocaleDateString("pt-BR", {
      weekday: "short",
    });

    const horario = dataObj.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });

    // Cabeçalho do dia
    if (data !== lastDate) {
      resposta += `🗓️ *${
        diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1)
      } • ${data}*\n`;
      lastDate = data;
    }

    resposta += `• ${r.text} — ${horario}\n\n`;
  });

  return resposta;
}

function getPeriodoLabel(periodo) {
  const hoje = new Date().toISOString().slice(0, 10);

  if (periodo.tipo === "day") {
    if (periodo.data_inicio === hoje) {
      return "de hoje";
    }

    const amanha = new Date();
    amanha.setDate(amanha.getDate() + 1);
    const amanhaISO = amanha.toISOString().slice(0, 10);

    if (periodo.data_inicio === amanhaISO) {
      return "de amanhã";
    }

    const [y, m, d] = periodo.data_inicio.split("-");
    return `do dia ${d}/${m}`;
  }

  if (periodo.tipo === "week") {
    return "dessa semana";
  }

  if (periodo.tipo === "month") {
    const [y, m] = periodo.data_inicio.split("-");
    return `do mês ${m}/${y}`;
  }

  return "";
}

function gerarOcorrenciasBackend(base) {
  if (!base.isRecurring) {
    return [{ ...base, data: base.when }];
  }

  const { tipo } = base.recurrence;
  const ocorrencias = [];

  let atual = new Date(base.when);
  const limite = new Date();
  limite.setDate(limite.getDate() + 90);

  while (atual <= limite) {
    ocorrencias.push({
      ...base,
      data: new Date(atual),
    });

    if (tipo === "diario") atual.setDate(atual.getDate() + 1);
    if (tipo === "semanal") atual.setDate(atual.getDate() + 7);
    if (tipo === "mensal") atual.setMonth(atual.getMonth() + 1);
    if (tipo === "anual") atual.setFullYear(atual.getFullYear() + 1);
  }

  return ocorrencias;
}
