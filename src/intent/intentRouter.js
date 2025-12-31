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

  // 1️⃣ USUÁRIO NÃO EXISTE
  if (!userData) {
    await updateUser(user, {
      stage: "awaiting_name",
      remindersUsed: 0,
      createdAt: Date.now(),
    });

    return "👋 Oi! Tudo bem? 😊\n\nAntes de tudo, como posso te chamar?";
  }

  // 2️⃣ AGUARDANDO NOME
  if (userData.stage === "awaiting_name") {
    const name = text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();

    await updateUser(user, {
      name,
      stage: "active",
    });

    return (
      `Perfeito, ${name}! 😄\n\n` +
      "Agora posso cuidar dos seus lembretes.\n\n" +
      "📌 Exemplos:\n" +
      "• me lembra daqui 10 minutos\n" +
      "• amanhã às 17h30 ir à academia\n" +
      "• listar lembretes"
    );
  }

  const interpretation = await interpretMessage(text);

  switch (interpretation.intencao) {
    case INTENTIONS.SAUDACAO:
      return responderSaudacao(userData);

      // 👇👇👇
      // SÓ DAQUI PRA BAIXO ENTRA IA

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
