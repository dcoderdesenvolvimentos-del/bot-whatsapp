import { getUser, updateUser } from "../services/userService.js";
import { interpretMessage } from "../ai/interpretMessage.js";
import { INTENTIONS } from "../constants/intentions.js";

import { responderSaudacao } from "../handlers/saudacao.js";
import { createReminder } from "../handlers/createReminder.js";
import { listReminders } from "../handlers/listReminders.js";
import { smallTalk } from "../handlers/smallTalk.js";
import { help } from "../handlers/help.js";
import { createMultipleReminders } from "../handlers/createMultipleReminders.js";

export async function routeIntent(user, text) {
  let userData = await getUser(user);
  const normalized = text.toLowerCase().trim();

  // =========================
  //🆕 PRIMEIRO CONTATO
  // =========================
  if (!userData) {
    await updateUser(user, {
      stage: "first_contact",
      remindersUsed: 0,
      createdAt: Date.now(),
    });

    return "👋 Oi! Tudo bem com você? 😊";
  }

  // =========================
  // 🟢 STAGE: first_contact
  // =========================
  if (userData.stage === "first_contact") {
    await updateUser(user, { stage: "awaiting_name" });
    return "👋 Antes de continuarmos, me diz: qual é o seu nome? 😊";
  }

  // =========================
  // 🟡 STAGE: awaiting_name
  // =========================
  if (userData.stage === "awaiting_name") {
    const tempName = normalized.charAt(0).toUpperCase() + normalized.slice(1);

    await updateUser(user, {
      stage: "confirming_name",
      tempName,
    });

    return (
      "✨ Só confirmando rapidinho…\n\n" +
      `👉 Seu nome é *${tempName}*?\n\n` +
      "Responda com:\n" +
      "✅ sim — para confirmar\n" +
      "❌ não — para corrigir"
    );
  }

  // =========================
  // 🟠 STAGE: confirming_name
  // =========================
  if (userData.stage === "confirming_name") {
    if (["sim", "s", "isso"].includes(normalized)) {
      const name = userData.tempName; // 👈 usa a variável local

      await updateUser(user, {
        stage: "active",
        name,
        tempName: null,
      });

      return (
        `✨ Perfeito, ${name}! Seja bem-vindo(a) 😊\n\n` +
        "A partir de agora, eu cuido dos seus lembretes.\n\n" +
        "📌 Exemplos:\n" +
        "• me lembra daqui 10 minutos\n" +
        "• amanhã às 17h30 ir à academia\n" +
        "• listar lembretes"
      );
    }

    if (["não", "nao"].includes(normalized)) {
      await updateUser(user, {
        stage: "awaiting_name",
        tempName: null,
      });

      return "Sem problema 😊 Qual é o seu nome então?";
    }

    return "Responda apenas *sim* ou *não*, por favor 🙂";
  }

  // =========================
  // 🟢 STAGE: active
  // =========================
  if (userData.stage !== "active") {
    await updateUser(user, { stage: "active" });
  }

  // =========================
  // 🧠 IA (só agora)
  // =========================
  const interpretation = await interpretMessage(text);

  switch (interpretation.intencao) {
    case INTENTIONS.SAUDACAO:
      return responderSaudacao(userData);

    case INTENTIONS.CRIAR_LEMBRETE:
      return createReminder(user, userData, interpretation);

    case INTENTIONS.CRIAR_MULTIPLOS_LEMBRETES:
      return createMultipleReminders(user, userData, interpretation);

    case INTENTIONS.LISTAR_LEMBRETES:
      return listReminders(user);

    case INTENTIONS.CONVERSA_SOLTA:
      return smallTalk();

    case INTENTIONS.AJUDA:
      return help();

    default:
      return help();
  }
}
