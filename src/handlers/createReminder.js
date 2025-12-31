import { addReminder } from "../services/reminderService.js";
import { updateUser } from "../services/userService.js";

export async function createReminder(user, userData, data) {
  console.log("📦 DATA RECEBIDO:", JSON.stringify(data, null, 2));

  console.log("🔥 CHEGOU NO CREATE REMINDER");
  console.log("🔥 DATA COMPLETO:", data);
  console.log("🔥 data.hora:", data.hora);
  console.log("🔥 typeof data.hora:", typeof data.hora);
  console.log("🔥 Date.now():", Date.now());

  console.log("📦 DATA RECEBIDO:", JSON.stringify(data, null, 2));

  const FREE_LIMIT = 3;

  function capitalizeFirst(text) {
    if (!text) return "";
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  // 🚨 VALIDAÇÃO: hora tem que existir
  if (!data.hora) {
    return "⚠️ Não consegui identificar o horário do lembrete.";
  }

  // 🚨 CONVERTE pra número se vier como string
  const when = typeof data.hora === "string" ? parseInt(data.hora) : data.hora;

  // 🚨 VALIDA se é timestamp válido
  if (isNaN(when) || when < Date.now()) {
    return "⚠️ Horário inválido ou no passado.";
  }

  // 📅 FORMATAR DATA E HORA
  const dateObj = new Date(when);

  const formattedDate = dateObj.toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
  });

  const formattedTime = dateObj.toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });

  // 💾 SALVAR LEMBRETE
  await addReminder(user, {
    text: capitalizeFirst(data.acao),
    when,
  });

  // 🔢 ATUALIZAR CONTADOR
  const remindersUsed = (userData.remindersUsed || 0) + 1;
  await updateUser(user, { remindersUsed });

  // ✅ RESPOSTA
  return (
    "✅ *Lembrete salvo com sucesso!*\n\n" +
    `📌 *Ação:* ${capitalizeFirst(data.acao)}\n` +
    `📅 *Data:* ${formattedDate}\n` +
    `⏰ *Horário:* ${formattedTime}`
  );
}
