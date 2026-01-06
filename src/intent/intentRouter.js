import { analyzeIntent } from "../ai/aiService.js";
import { createReminder } from "./createReminder.js";
import { listReminders } from "./listReminders.js";
import { deleteReminder } from "./deleteReminder.js";
import { getOrCreateUser } from "../services/userService.js";

export async function routeIntent(userDoc, text) {
  console.log("🚨 ROUTE INTENT EXECUTADO");

  const phone = userDoc.id; // ← pega o ID do documento (que é o telefone)
  console.log("👤 USER:", phone);
  console.log("💬 TEXT:", text);

  try {
    const data = await analyzeIntent(text);
    console.log("📦 DATA RECEBIDO:", JSON.stringify(data, null, 2));

    // passa o userDoc pros handlers
    let response = "";

    switch (data.intencao) {
      case "criar_lembrete":
        response = await createReminder(userDoc, data); // ← só 2 params
        break;

      case "listar_lembretes":
        response = await listReminders(user);
        break;

      case "excluir_lembrete":
        response = await deleteReminder(user, data);
        break;

      case "saudacao":
        response =
          "👋 Olá! Sou seu assistente de lembretes!\n\n" +
          "📋 Posso te ajudar com:\n\n" +
          "• ✅ Criar lembretes\n" +
          "• 📝 Listar lembretes\n" +
          "• 🗑️ Excluir lembretes\n\n" +
          "Exemplo: 'me lembra de comprar pão amanhã às 10h'";
        break;

      case "ajuda":
        response =
          "🤖 *Como usar o bot de lembretes:*\n\n" +
          "📌 *Criar:* 'me lembra de tomar água daqui 2 minutos'\n" +
          "📋 *Listar:* 'quais são meus lembretes?'\n" +
          "🗑️ *Excluir:* 'apaga o lembrete 1'\n\n" +
          "💡 *Dica:* Use linguagem natural!";
        break;

      case "despedida":
        response = "👋 Até logo! Estou aqui quando precisar! 😊";
        break;

      default:
        response =
          "🤔 Desculpa, não entendi.\n\n" +
          "Tente:\n" +
          "• 'me lembra de X amanhã às 10h'\n" +
          "• 'lista meus lembretes'\n" +
          "• 'apaga o lembrete 1'";
    }

    return response;
  } catch (error) {
    console.error("❌ Erro no routeIntent:", error);
    return "❌ Ops! Algo deu errado. Tente novamente.";
  }
}
