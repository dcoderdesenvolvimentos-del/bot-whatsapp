import { addReminder } from "../services/reminderService.js";

export async function createReminder(userDoc, data) {
  console.log("🔥 CHEGOU NO CREATE REMINDER");
  console.log("🔥 USER DOC ID:", userDoc.id);
  console.log("🔥 DATA COMPLETO:", data);

  const phone = userDoc.id;

  if (!phone) {
    console.error("❌ PHONE UNDEFINED!");
    return "❌ Erro ao identificar usuário.";
  }

  // Valida timestamp
  if (!data.hora || typeof data.hora !== "number") {
    return "❌ Não consegui entender o horário. Tente: 'me lembra de X daqui 10 minutos'";
  }

  // Valida se não é passado
  if (data.hora < Date.now()) {
    return "❌ Esse horário já passou! Tente um horário futuro.";
  }

  // Salva usando o service
  await addReminder(phone, {
    text: data.acao,
    when: data.hora,
  });

  const dataFormatada = new Date(data.hora).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo", // ✅ ADICIONADO
  });

  console.log("🔍 HORA RECEBIDA:", data.hora);
  console.log("🔍 DATE OBJECT:", new Date(data.hora));
  console.log("🔍 FORMATADO:", dataFormatada);

  return `✅ Lembrete criado!\n\n📌 ${data.acao}\n🕐 ${dataFormatada}`;
}
