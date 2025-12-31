import { getUser } from "../services/userService.js";
import { interpretMessage } from "../ai/interpretMessage.js";
import { intentMap } from "./intentMap.js";

export async function routeIntent(user, text) {
  const userData = await getUser(user);
  const interpretation = await interpretMessage(text);

  console.log("🧠 Intenção:", interpretation.intencao);
  console.log("📋 Dados:", interpretation);

  const handler = intentMap[interpretation.intencao] || intentMap.desconhecido;

  return handler(user, userData, interpretation);
}
