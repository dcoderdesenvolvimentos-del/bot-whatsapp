import { addReminder } from "../services/reminderService.js";
import { createTimestampBR } from "../utils/dateUtils.js";

export async function createReminder(userDocId, data) {
  console.log("🔥 CHEGOU NO CREATE REMINDER");
  console.log("🔥 USER DOC ID:", userDocId);
  console.log("🔥 DATA COMPLETO:", data);

  const phone = userDocId;

  if (!phone) {
    console.error("❌ PHONE UNDEFINED!");
    return "❌ Erro ao identificar usuário.";
  }

  /**
   * =====================================================
   * ⏱️ CASO 1 — OFFSET RELATIVO (daqui X minutos / horas)
   * =====================================================
   * 👉 PRIORIDADE MÁXIMA
   * Se existir offset_ms, ignora TODO o resto
   */
  if (typeof data.offset_ms === "number" && data.offset_ms > 0) {
    const when = Date.now() + data.offset_ms;

    await addReminder(phone, {
      text: data.acao,
      when,
    });

    const dateObj = new Date(when);

    return (
      `✅ *Lembrete criado!*\n\n` +
      `📌 ${data.acao}\n` +
      `🕐 ${dateObj.toLocaleString("pt-BR", {
        timeZone: "America/Sao_Paulo",
      })}`
    );
  }

  /**
   * =====================================================
   * 🧩 CASO 2 — REGRA ANTIGA "DAQUI X MINUTOS"
   * =====================================================
   * 👉 Mantida por compatibilidade
   * 👉 Só entra se NÃO houver offset_ms
   */
  if (
    data.offset_dias === 0 &&
    data.hora === 0 &&
    typeof data.minuto === "number" &&
    data.minuto > 0
  ) {
    const when = Date.now() + data.minuto * 60 * 1000;

    await addReminder(phone, {
      text: data.acao,
      when,
    });

    const dateObj = new Date(when);

    return (
      `✅ *Lembrete criado!*\n\n` +
      `📌 ${data.acao}\n` +
      `🕐 ${dateObj.toLocaleString("pt-BR", {
        timeZone: "America/Sao_Paulo",
      })}`
    );
  }

  /**
   * =====================================================
   * 🕒 CASO 3 — HORÁRIO ABSOLUTO (flexível)
   * =====================================================
   */

  // 👉 NORMALIZAÇÃO SEGURA
  const offset_dias =
    typeof data.offset_dias === "number" ? data.offset_dias : 0;

  let hora = typeof data.hora === "number" ? data.hora : null;
  let minuto = typeof data.minuto === "number" ? data.minuto : null;

  // ❌ Se não veio NADA de tempo, aí sim erro
  if (hora === null && minuto === null && offset_dias === null) {
    return "❌ Não consegui entender quando devo te lembrar.";
  }

  // 🧠 REGRA: só data → 00:01
  if (hora === null && minuto === null) {
    hora = 0;
    minuto = 1;
  }

  // 🧠 REGRA: só hora → hoje
  if (hora !== null && minuto === null) {
    minuto = 0;
  }

  // 🕒 Cria timestamp usando SUA função existente
  const when = createTimestampBR({
    offset_dias,
    hora,
    minuto,
  });

  // ⛔ Bloqueia passado
  if (when < Date.now()) {
    return "❌ Esse horário já passou! Tente um horário futuro.";
  }

  // 💾 Salva no Firestore
  await addReminder(phone, {
    text: data.acao,
    when,
  });

  // 🔍 DEBUG FINAL (agora confiável)
  const dateObj = new Date(when);
  console.log("🔍 TIMESTAMP FINAL:", when);
  console.log("🔍 ISO STRING:", dateObj.toISOString());
  console.log(
    "🔍 TIMEZONE SERVIDOR:",
    Intl.DateTimeFormat().resolvedOptions().timeZone
  );
  console.log("🔍 LOCAL BR:", dateObj.toLocaleString("pt-BR"));

  // 📅 FORMATAÇÃO FINAL
  const dataFormatada = dateObj.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });

  return `✅ *Lembrete criado!*\n\n📌 ${data.acao}\n🕐 ${dataFormatada}`;
}
