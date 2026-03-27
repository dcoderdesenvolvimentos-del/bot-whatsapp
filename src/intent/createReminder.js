import { addReminder } from "../services/reminderService.js";
import { generateReminderDescription } from "../services/reminderDescriptionService.js";
import { nextWeekdayUTC } from "../utils/dateUtils.js";
import { Timestamp } from "firebase-admin/firestore";

/**
 * ============================================================
 * 🧠 buildWhen
 * ÚNICO lugar que calcula datas de lembretes
 * ============================================================
 */
function buildWhen(data) {
  const now = new Date();

  // 1️⃣ OFFSET EM MS — "daqui 2 minutos"
  if (typeof data.offset_ms === "number" && data.offset_ms > 0) {
    return Timestamp.fromMillis(Date.now() + data.offset_ms);
  }

  // 2️⃣ OFFSET EM MINUTOS — "daqui 10 minutos"
  if (typeof data.offset_minutos === "number" && data.offset_minutos > 0) {
    return Timestamp.fromMillis(Date.now() + data.offset_minutos * 60 * 1000);
  }

  // 3️⃣ OFFSET EM HORAS — "daqui 2 horas"
  if (typeof data.offset_horas === "number" && data.offset_horas > 0) {
    return Timestamp.fromMillis(
      Date.now() + data.offset_horas * 60 * 60 * 1000,
    );
  }

  // 4️⃣ OFFSET EM DIAS (sem hora) — "amanhã"
  if (
    typeof data.offset_dias === "number" &&
    data.offset_dias > 0 &&
    typeof data.hora !== "number"
  ) {
    const future = new Date(now);
    future.setDate(future.getDate() + data.offset_dias);
    future.setHours(9, 0, 0, 0); // padrão 09:00
    return Timestamp.fromDate(future);
  }

  // 5️⃣ DIA DA SEMANA — "terça às 14"
  if (typeof data.weekday === "number") {
    const date = nextWeekdayUTC(data.weekday, data.hora ?? 9, data.minuto ?? 0);
    return Timestamp.fromDate(date);
  }

  // 6️⃣ OFFSET EM DIAS + HORA — "amanhã às 10"
  if (typeof data.offset_dias === "number" && typeof data.hora === "number") {
    let hora = ajustarHoraInteligente(data, data.hora);

    const local = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + data.offset_dias,
      hora,
      data.minuto ?? 0,
      0,
      0,
    );

    return Timestamp.fromDate(local);
  }

  // 7️⃣ DIA DO MÊS + HORA — "dia 24 às 9"
  if (typeof data.dia === "number" && typeof data.hora === "number") {
    const year = now.getFullYear();
    let month = now.getMonth(); // 0 = janeiro

    let date = new Date(
      year,
      month,
      data.dia,
      data.hora,
      data.minuto ?? 0,
      0,
      0,
    );

    // se o dia já passou neste mês, joga para o próximo
    if (date <= now) {
      month += 1;
      date = new Date(year, month, data.dia, data.hora, data.minuto ?? 0, 0, 0);
    }

    return Timestamp.fromDate(date);
  }

  // 7️⃣ HORA SOLTA — "às 15"
  if (typeof data.hora === "number") {
    let hora = ajustarHoraInteligente(data, data.hora);

    const local = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      hora,
      data.minuto ?? 0,
      0,
      0,
    );

    // se já passou hoje, joga pra amanhã
    if (local <= now) {
      local.setDate(local.getDate() + 1);
    }

    return Timestamp.fromDate(local);
  }

  // 7️⃣ DIA DO MÊS ISOLADO — "dia 24"
  if (typeof data.dia === "number") {
    const year = now.getFullYear();
    let month = now.getMonth(); // 0 = janeiro

    let date = new Date(
      year,
      month,
      data.dia,
      data.hora ?? 9,
      data.minuto ?? 0,
      0,
      0,
    );

    // se o dia já passou neste mês, joga para o próximo
    if (date <= now) {
      month += 1;
      date = new Date(
        year,
        month,
        data.dia,
        data.hora ?? 9,
        data.minuto ?? 0,
        0,
        0,
      );
    }

    return Timestamp.fromDate(date);
  }

  // 8️⃣ FALLBACK — 5 minutos
  return Timestamp.fromMillis(Date.now() + 5 * 60 * 1000);
}

/**
 * ============================================================
 * 🔥 CORE
 * ÚNICA função que cria lembrete individual
 * ============================================================
 *
 */
async function createReminderCore(uid, data) {
  const when = buildWhen(data);

  if (!when || when.toMillis() <= Timestamp.now().toMillis()) {
    throw new Error("❌ Esse horário já passou! Tente um horário futuro.");
  }

  const texto = data.acao || data.text;
  if (!texto) {
    throw new Error("❌ Não consegui identificar o lembrete.");
  }

  // 🔥 SALVA PELO UID (CORRETO)
  await addReminder(uid, {
    text: texto,
    when,
  });

  let descricaoIA = null;
  try {
    descricaoIA = await generateReminderDescription(texto);
  } catch {}

  return { texto, when, descricaoIA };
}

/**
 * ============================================================
 * 🧾 createReminder
 * Função pública (único / múltiplos)
 * ============================================================
 */

export async function createReminder(userDocId, data) {
  const uid = userDocId;
  if (!uid) return "❌ Usuário inválido.";

  // normaliza tudo para array
  const itens = Array.isArray(data.lembretes) ? data.lembretes : [data];

  const resultados = [];

  for (const item of itens) {
    try {
      const r = await createReminderCore(uid, item);
      resultados.push(r);
    } catch (err) {
      return err.message;
    }
  }

  // 🔹 CASO ÚNICO → MOSTRA DESCRIÇÃO DA IA
  if (resultados.length === 1) {
    const r = resultados[0];

    let resposta =
      `✅ *Compromisso Registrado!*\n\n` +
      `📌 ${r.texto}\n` +
      `🕐 ${new Date(r.when.toMillis()).toLocaleString("pt-BR")}`;

    if (r.descricaoIA) {
      resposta += `\n\n💬 ${r.descricaoIA}`;
    }

    return resposta;
  }

  // 🔹 CASO MÚLTIPLO → NÃO MOSTRA DESCRIÇÃO DA IA
  let respostaFinal = `✅ *Prontinho!* Registrei ${resultados.length} Compromissos:\n\n`;

  resultados.forEach((r, i) => {
    respostaFinal +=
      `${i + 1}️⃣ ` +
      `${new Date(r.when.toMillis()).toLocaleString("pt-BR")} — ` +
      `${r.texto}\n`;
  });

  return respostaFinal.trim();
}

function ajustarHoraInteligente(data, hora) {
  const texto = (data.text || data.acao || "").toLowerCase();

  if (texto.includes("manhã") || texto.includes("madrugada")) {
    if (hora === 12) return 0;
    return hora;
  }

  if (texto.includes("tarde") || texto.includes("noite")) {
    if (hora < 12) return hora + 12;
    return hora;
  }

  // 🔥 REGRA NOVA:
  // NÃO inventa período

  // 🔥 NOVO: se tem data futura (tipo "amanhã")
  // NÃO inventa período
  if (data.offset_dias || data.dia || data.weekday) {
    return hora;
  }

  return hora;
}
