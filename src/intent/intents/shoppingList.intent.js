import {
  addItem,
  removeItem,
  listItems,
  markDone,
  clearList,
} from "../../services/shoppingList.service.js";

export function handleShoppingListIntent({ userId, data }) {
  switch (data.intent) {
    case "add_item":
      addItem(userId, data.list || "principal", data.items);
      return "🛒 Itens adicionados à sua lista com sucesso!";

    case "list_items":
      return listItems(userId, data.list || "principal");

    case "remove_item":
      removeItem(userId, data.list || "principal", data.item);
      return "🗑️ Item removido da lista.";

    case "mark_done":
      markDone(userId, data.list || "principal", data.item);
      return "✅ Item marcado como comprado.";

    case "clear_list":
      clearList(userId, data.list || "principal");
      return "🧹 Lista limpa com sucesso.";
  }
}
