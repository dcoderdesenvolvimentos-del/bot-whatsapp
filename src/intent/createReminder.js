import { addReminder } from "../services/reminderService.js";

export async function createReminder(userDocId, data) {
  console.log("🔥 CHEGOU NO CREATE REMINDER");
  console.log("🔥 USER DOC ID:", userDocId);
  console.log("🔥 DATA COMPLETO:", data);

  const phone = userDocId;

  if (!phone) {
    console.error("❌ PHONE UNDEFINED!");
    return "❌ Erro ao identificar usuário.";
  }

  if (!data.hora || typeof data.hora !== "number") {
    return "❌ Não consegui entender o horário. Tente: 'me lembra de X daqui 10 minutos'";
  }

  if (data.hora < Date.now()) {
    return "❌ Esse horário já passou! Tente um horário futuro.";
  }

  await addReminder(phone, {
    text: data.acao,
    when: data.hora,
  });

  // 🔍 DEBUG COMPLETO
  const dateObj = new Date(data.hora);
  console.log("🔍 TIMESTAMP RECEBIDO:", data.hora);
  console.log("🔍 DATE OBJECT:", dateObj);
  console.log("🔍 ISO STRING:", dateObj.toISOString());
  console.log(
    "🔍 TIMEZONE SERVIDOR:",
    Intl.DateTimeFormat().resolvedOptions().timeZone
  );

  const dataFormatada = dateObj.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  });

  console.log("🔍 FORMATADO FINAL:", dataFormatada);

  return `✅ Lembrete criado!\n\n📌 ${data.acao}\n🕐 ${dataFormatada}`;
}
