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

  // 🔒 Validação obrigatória
  if (
    typeof data.offset_dias !== "number" ||
    typeof data.hora !== "number" ||
    typeof data.minuto !== "number"
  ) {
    return "❌ Não consegui entender o horário. Tente: 'me lembra de beber água amanhã às 17h'";
  }

  // ⏱️ CASO "DAQUI X MINUTOS"
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
      `🕐 ${dateObj.toLocaleString("pt-BR")}`
    );
  }

  // 🕒 CRIA O TIMESTAMP CORRETO (BR → UTC)
  const when = createTimestampBR({
    offset_dias: data.offset_dias,
    hora: data.hora,
    minuto: data.minuto,
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

  // 🔍 DEBUG FINAL (AGORA CONFIÁVEL)
  const dateObj = new Date(when);
  console.log("🔍 TIMESTAMP FINAL:", when);
  console.log("🔍 ISO STRING:", dateObj.toISOString());
  console.log(
    "🔍 TIMEZONE SERVIDOR:",
    Intl.DateTimeFormat().resolvedOptions().timeZone
  );
  console.log("🔍 LOCAL BR:", dateObj.toLocaleString("pt-BR"));

  // 📅 FORMATAÇÃO FINAL (SEM TIMEZONE MANUAL)
  const dataFormatada = dateObj.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });

  return `✅ *Lembrete criado!*\n\n📌 ${data.acao}\n🕐 ${dataFormatada}`;
}
