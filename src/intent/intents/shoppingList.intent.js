import {
  createList,
  addItem,
  listItems,
  removeItem,
  clearList,
} from "../../services/shoppingList.service.js";

export function handleShoppingListIntent({ userId, data }) {
  const listName = data.lista || data.list || "principal";

  switch (data.intencao) {
    case "criar_lista":
      createList(userId, listName);
      return `🛒 Lista *${listName}* criada com sucesso!`;

    case "adicionar_item_lista":
      addItem(userId, listName, data.itens || []);
      return "🛒 Itens adicionados à lista!";

    case "listar_itens_lista":
      return listItems(userId, listName);

    case "remover_item_lista":
      removeItem(userId, listName, data.item);
      return "🗑️ Item removido da lista.";

    case "limpar_lista":
      clearList(userId, listName);
      return "🧹 Lista limpa com sucesso.";

    default:
      return "🤔 Não entendi o que fazer com a lista.";
  }
}
