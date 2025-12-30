import { interpretMessage } from "../ai/interpretMessage.js";
import { intentMap } from "./intentMap.js";
import { responderSaudacao } from "./handlers/saudacao.js";

export async function routeIntent(ctx) {
  const interpretation = await interpretMessage(ctx.text);
  const handler = intentMap[interpretation.intencao] || intentMap.desconhecido;
  return handler(ctx, interpretation);
}

function responderConversaSolta(user) {
  return "😄 Estou por aqui sim!\nQuer criar ou listar um lembrete?";
}

if (
  userData.stage === "active" &&
  [
    "oi",
    "olá",
    "boa noite",
    "bom dia",
    "boa tarde",
    "oi mario",
    "ola mario",
    "opa",
    "e ai",
    "iae",
    "fala campeão",
  ].includes(normalized)
) {
  return (
    `👋 *Oi, ${name}!*\n\n` +
    `Em que posso te ajudar? 😊\n\n` +
    `• Criar lembretes\n` +
    `• Listar lembretes\n`
  );
}

export function responderSaudacao(userData) {
  const name = userData?.name || "";

  return (
    `👋 *Oi${name ? `, ${name}` : ""}!*\n\n` +
    `Em que posso te ajudar nesse momento? 😊\n\n` +
    `📌 *Exemplos:*\n` +
    `• me lembra daqui 10 minutos\n` +
    `• amanhã às 17h30 ir à academia\n` +
    `• listar lembretes\n\n` +
    `🎤 Pode falar ou digitar 😉`
  );
}
