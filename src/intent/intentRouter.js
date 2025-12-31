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
  // ONBOARDING / CAPTAÇÃO DE NOME
  // =========================

  // PRIMEIRO CONTATO
  if (userData.stage === "first_contact") {
    await updateUser(user, { stage: "awaiting_name" });
    return "👋 Oi! Antes de tudo, qual é o seu nome? 😊";
  }

  // USUÁRIO RESPONDENDO O NOME
  if (userData.stage === "awaiting_name") {
    const name = text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();

    await updateUser(user, {
      stage: "confirming_name",
      tempName: name,
    });

    return (
      `✨ Só confirmando rapidinho...\n\n` +
      `Seu nome é *${name}*?\n\n` +
      `Responda com:\n` +
      `✅ sim\n❌ não`
    );
  }

  // CONFIRMAÇÃO DO NOME
  if (userData.stage === "confirming_name") {
    if (["sim", "isso", "correto", "pode ser"].includes(text)) {
      await updateUser(user, {
        name: userData.tempName,
        tempName: null,
        stage: "active",
      });

      return (
        `🎉 Perfeito, *${userData.tempName}*! Seja bem-vindo(a) 😊\n\n` +
        `Agora é só me dizer o que você quer lembrar 😉`
      );
    }

    if (["nao", "não"].includes(text)) {
      await updateUser(user, { stage: "awaiting_name", tempName: null });
      return "Sem problema 😄 Qual é o seu nome então?";
    }

    return "Responda apenas *sim* ou *não*, por favor 🙂";
  }

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
