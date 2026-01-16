import { db } from "../firebase.js";

function startOfTodayBR() {
  const now = new Date();
  const hojeBR = new Date(
    now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })
  );

  hojeBR.setHours(0, 0, 0, 0);
  return hojeBR.getTime();
}

function startOfDayFromTimestampBR(timestamp) {
  const d = new Date(
    new Date(timestamp).toLocaleString("en-US", {
      timeZone: "America/Sao_Paulo",
    })
  );
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

  const start = startOfDay(periodo.data_inicio);
  const end = endOfDay(periodo.data_fim);

  const snapshot = await db
    .collection("reminders")
    .where("phone", "==", userId)
    .where("when", ">=", start)
    .where("when", "<=", end)
    .orderBy("when", "asc")
    .get();

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

    const inicioDiaCompromissoBR = startOfDayFromTimestampBR(r.when);

    // ❌ REGRA 1 — mês/semana: não mostrar dias anteriores a hoje
    if (inicioDiaCompromissoBR < hojeInicioBR) {
      return;
    }

    // ❌ REGRA 2 — HOJE: respeita limite de 6h
    if (inicioDiaCompromissoBR === hojeInicioBR && r.when < agora - LIMITE_MS) {
      return;
    }

    const dataObj = new Date(r.when);

    const data = dataObj.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      timeZone: "America/Sao_Paulo",
    });

    const diaSemana = dataObj.toLocaleDateString("pt-BR", {
      weekday: "short",
      timeZone: "America/Sao_Paulo",
    });

    const horario = dataObj.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Sao_Paulo",
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
