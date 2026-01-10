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

  // 🛡️ PROTEÇÃO CONTRA ERRO DA IA
  if (typeof data.dia === "number") {
    // Se for dia do mês, ignora qualquer offset
    data.offset_dias = null;
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
   * 🕒 CASO 3 — HORÁRIO ABSOLUTO (com dia do mês)
   * =====================================================
   */

  // 🔹 AGORA = referência
  const now = new Date();

  // 🔹 Normaliza offset (padrão: hoje)
  let offsetDiasFinal =
    typeof data.offset_dias === "number" ? data.offset_dias : 0;

  // 🔒 Normaliza hora/minuto (regra que você já aprovou)
  let hora = typeof data.hora === "number" ? data.hora : null;

  let minuto = typeof data.minuto === "number" ? data.minuto : null;

  // ❌ Se não veio nenhuma informação de tempo
  if (
    hora === null &&
    minuto === null &&
    typeof data.dia !== "number" &&
    typeof offsetDiasFinal !== "number"
  ) {
    return "❌ Não consegui entender quando devo te lembrar.";
  }

  /**
   * ============================================
   * 🧠 AJUSTE DE DATA ABSOLUTA (DIA DO MÊS)
   * ============================================
   * Exemplo: "dia 12"
   */
  if (typeof data.dia === "number") {
    // 🎯 Cria data alvo no mês atual
    const alvo = new Date(now.getFullYear(), now.getMonth(), data.dia, 0, 1, 0);

    // ⏩ Se o dia já passou, joga pro mês seguinte
    if (alvo < now) {
      alvo.setMonth(alvo.getMonth() + 1);
    }

    // 🔁 Converte para offset_dias
    offsetDiasFinal = Math.ceil((alvo - now) / (1000 * 60 * 60 * 24));
  }

  // 🧠 Só data → 00:01
  if (hora === null && minuto === null) {
    hora = 0;
    minuto = 1;
  }

  // 🧠 Só hora → hoje
  if (hora !== null && minuto === null) {
    minuto = 0;
  }

  // 🕒 AGORA SIM: cria timestamp
  const when = createTimestampBR({
    offset_dias: offsetDiasFinal,
    hora,
    minuto,
  });

  // ⛔ Bloqueia passado
  if (when < Date.now()) {
    return "❌ Esse horário já passou! Tente um horário futuro.";
  }

  // 💾 Salva
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
