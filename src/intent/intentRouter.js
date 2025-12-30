import { interpretMessage } from "../ai/interpretMessage.js";
import { intentMap } from "./intentMap.js";

export async function routeIntent(user, text) {
  const interpretation = await interpretMessage(text);

  console.log("🧠 Intenção:", interpretation.intencao);
  console.log("📋 Dados:", interpretation);

  const handler = intentMap[interpretation.intencao] || intentMap.desconhecido;

  const userData = { phone: user, text };

  return handler(userData, interpretation);
}
