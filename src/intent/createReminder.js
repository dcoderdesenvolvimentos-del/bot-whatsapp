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

  // 🔥 NOVO PADRÃO (IGUAL RECORRENTE)
  if (data.data_string) {
    const [dia, mes] = data.data_string.split("-").map(Number);

    let date = new Date(
      now.getFullYear(),
      mes - 1,
      dia,
      data.hora ?? 9,
      data.minuto ?? 0,
      0,
      0,
    );

    // 🔥 SE JÁ PASSOU → PRÓXIMO ANO
    if (date <= now) {
      date = new Date(
        now.getFullYear() + 1,
        mes - 1,
        dia,
        data.hora ?? 9,
        data.minuto ?? 0,
        0,
        0,
      );
    }

    return Timestamp.fromDate(date);
  }

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
    let month = typeof data.mes === "number" ? data.mes - 1 : now.getMonth();

    let date = new Date(
      year,
      month,
      data.dia,
      data.hora,
      data.minuto ?? 0,
      0,
      0,
    );

    if (date <= now) {
      if (typeof data.mes === "number") {
        // 🔥 usuário definiu mês → pula pro próximo ano
        date = new Date(
          year + 1,
          month,
          data.dia,
          data.hora ?? 9,
          data.minuto ?? 0,
          0,
          0,
        );
      } else {
        // 🔁 comportamento antigo (sem mês)
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
    let month = typeof data.mes === "number" ? data.mes - 1 : now.getMonth();

    let date = new Date(
      year,
      month,
      data.dia,
      data.hora ?? 9,
      data.minuto ?? 0,
      0,
      0,
    );

    if (date <= now) {
      if (typeof data.mes === "number") {
        // 🔥 usuário definiu mês → pula pro próximo ano
        date = new Date(
          year + 1,
          month,
          data.dia,
          data.hora ?? 9,
          data.minuto ?? 0,
          0,
          0,
        );
      } else {
        // 🔁 comportamento antigo (sem mês)
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
      // 🔥 CORREÇÃO AQUI
      const itemCorrigido = corrigirDataDoTexto(data.textoOriginal || "", item);

      const r = await createReminderCore(uid, itemCorrigido);
      resultados.push(r);
    } catch (err) {
      return err.message;
    }
  }

  // 🔹 CASO ÚNICO → MOSTRA DESCRIÇÃO DA IA
  if (resultados.length === 1) {
    const r = resultados[0];
    const textoFormatado = r.texto
      ? r.texto.charAt(0).toUpperCase() + r.texto.slice(1)
      : "";

    let resposta =
      `✅ *Compromisso Registrado!*\n\n` +
      `📌 ${textoFormatado}\n` +
      `🕐 ${new Date(r.when.toMillis()).toLocaleString("pt-BR")}`;

    if (r.descricaoIA) {
      resposta += `\n\n💬 ${r.descricaoIA}`;
    }

    return resposta;
  }

  // 🔹 CASO MÚLTIPLO → NÃO MOSTRA DESCRIÇÃO DA IA
  let respostaFinal = `✅ *Prontinho!* Registrei ${resultados.length} Compromissos:\n\n`;

  function capitalize2(texto) {
    if (!texto) return "";
    return texto.charAt(0).toUpperCase() + texto.slice(1);
  }
  resultados.forEach((r, i) => {
    respostaFinal +=
      `${i + 1}️⃣ ` +
      `${new Date(r.when.toMillis()).toLocaleString("pt-BR")} — ` +
      `${capitalize2(r.texto)}\n`;
  });

  return respostaFinal.trim();
}

function corrigirDataDoTexto(texto, item) {
  const match = texto.match(/(\d{1,2})[\/\-.](\d{1,2})/);

  if (match) {
    const dia = parseInt(match[1]);
    const mes = parseInt(match[2]);

    return {
      ...item,
      dia,
      mes,
      data_string: `${String(dia).padStart(2, "0")}-${String(mes).padStart(2, "0")}`, // 🔥 NOVO
    };
  }

  // 🔥 SE JÁ VEIO DA IA
  if (item.dia && item.mes) {
    return {
      ...item,
      data_string: `${String(item.dia).padStart(2, "0")}-${String(item.mes).padStart(2, "0")}`,
    };
  }

  return item;
}

function ajustarHoraInteligente(data, hora) {
  const texto = (data.text || data.acao || "").toLowerCase();

  const isManha = texto.includes("manhã") || texto.includes("madrugada");
  const isTarde = texto.includes("tarde");
  const isNoite = texto.includes("noite");

  // ✅ se falou explicitamente
  if (isManha) {
    if (hora === 12) return 0;
    return hora;
  }

  if (isTarde || isNoite) {
    if (hora < 12) return hora + 12;
    return hora;
  }

  // 🔥 NOVO: se tem data futura (tipo "amanhã")
  // NÃO inventa período
  if (data.offset_dias || data.dia || data.weekday) {
    return hora;
  }

  // 🔥 fallback (opcional)
  return hora;
}
