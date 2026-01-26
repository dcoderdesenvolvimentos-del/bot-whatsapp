import { getAllUserLists } from "../services/shoppingListService";

export async function listarTodasListas(userId) {
  const listas = await getAllUserLists(userId);

  if (listas.length === 0) {
    return "📭 Você ainda não tem nenhuma lista criada.";
  }

  let resposta = "📋 *Suas listas de compras:*\n\n";

  listas.forEach((nome, index) => {
    resposta += `${index + 1}️⃣ ${nome}\n`;
  });

  return resposta;
}
