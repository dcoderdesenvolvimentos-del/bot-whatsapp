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
