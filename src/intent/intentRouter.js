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
  // 🔹 BUSCA USUÁRIO (IGUAL AO SEU CÓDIGO ANTIGO)
  let userData = await getUser(user);

  // 🔹 PRIMEIRO CONTATO (igual antes)
  if (!userData) {
    await updateUser(user, {
      stage: "first_contact",
      remindersUsed: 0,
      createdAt: Date.now(),
    });

    return "👋 Oi! Tudo bem? 😊";
  }

  // 🔹 IA SÓ INTERPRETA
  const interpretation = await interpretMessage(text);

  switch (interpretation.intencao) {
    case INTENTIONS.SAUDACAO:
      return responderSaudacao(user, userData);

    case INTENTIONS.CRIAR_LEMBRETE:
      return createReminder(user, userData, interpretation);

    case INTENTIONS.LISTAR_LEMBRETES:
      return listReminders(user);

    case INTENTIONS.CONVERSA_SOLTA:
      return smallTalk();

    case INTENTIONS.AJUDA:
      return help();

    case INTENTIONS.CRIAR_MULTIPLOS_LEMBRETES:
      return createMultipleReminders(user, userData, interpretation);

    default:
      return help();
  }
}
