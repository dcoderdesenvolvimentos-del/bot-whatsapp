import { db } from "../firebase.js";

export async function listarCompromissosPorPeriodo({
  userId,
  periodo,
  userName,
}) {
  if (!periodo?.data_inicio || !periodo?.data_fim) {
    return "⚠️ Não consegui identificar o período dos compromissos.";
  }

  // 🔒 Fuso Brasil fixo
  const startDate = new Date(periodo.data_inicio + "T00:00:00-03:00");
  const endDate = new Date(periodo.data_fim + "T23:59:59-03:00");

  const snapshot = await db
    .collection("users")
    .doc(userId)
    .collection("reminders")
    .get();

  let lista = [];

  snapshot.forEach((doc) => {
    const l = doc.data();

    if (!l.when) return;

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
      if (
        o.data.getTime() >= startDate.getTime() &&
        o.data.getTime() <= endDate.getTime()
      ) {
        lista.push(o);
      }
    });
  });

  // ✅ AGORA verifica a lista filtrada
  if (lista.length === 0) {
    return "📭 Você não tem compromissos nesse período.";
  }

  // 🔥 Ordena por data
  lista.sort((a, b) => a.data - b.data);

  const nome = userName ? ` ${userName}` : "";
  const periodoLabel = getPeriodoLabel(periodo);

  let resposta = `📅 *Olá${nome}, aqui estão seus compromissos ${periodoLabel}:*\n\n`;

  let lastDate = null;

  lista.forEach((item) => {
    const dataObj = item.data;

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

    if (data !== lastDate) {
      resposta += `🗓️ *${
        diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1)
      } • ${data}*\n`;
      lastDate = data;
    }

    resposta += `• ${item.text} — ${horario}\n\n`;
  });

  return resposta;
}

/* ================== LABEL PERÍODO ================== */

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

/* ================== RECORRÊNCIA ================== */

function gerarOcorrenciasBackend(base) {
  if (!base.isRecurring) {
    return [{ ...base, data: base.when }];
  }

  const { tipo } = base.recurrence;
  const ocorrencias = [];

  let atual = new Date(base.when);

  // gera até 90 dias futuros
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
