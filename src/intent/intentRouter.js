import { interpretMessage } from "../ai/interpretMessage.js";
import { intentMap } from "./intentMap.js";
import { responderSaudacao } from "../handlers/saudacao.js";

export async function routeIntent(userData) {
  const interpretation = await interpretMessage(text);

  console.log("🧠 Intenção:", interpretation.intencao);
  console.log("📋 Dados:", interpretation);

  const handler = intentMap[interpretation.intencao] || intentMap.desconhecido;

  const userData = { phone: user, text };

  return handler(userData, interpretation);
}
function responderConversaSolta(userData) {
  return "😄 Estou por aqui sim!\nQuer criar ou listar um lembrete?";
}
