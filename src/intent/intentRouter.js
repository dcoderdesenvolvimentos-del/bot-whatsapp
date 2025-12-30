import { interpretMessage } from "../ai/interpretMessage.js";
import { intentMap } from "./intentMap.js";

export async function routeIntent(ctx) {
  const interpretation = await interpretMessage(ctx.text);
  const handler = intentMap[interpretation.intencao] || intentMap.desconhecido;
  return handler(ctx, interpretation);
}