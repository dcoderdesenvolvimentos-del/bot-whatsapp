// src/services/shoppingListService.js
import { db } from "../firebase.js";

export async function createShoppingListWithItems(userId, items = []) {
  const ref = db.collection("shopping_lists").doc(userId);
  const snap = await ref.get();

  const formattedItems = items.map((item) => ({
    name: item.toLowerCase(),
    checked: false,
    createdAt: new Date(),
  }));

  // 🔹 Se a lista ainda não existe
  if (!snap.exists) {
    await ref.set({
      items: formattedItems,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return { created: true, added: formattedItems.length };
  }

  // 🔹 Se já existe, adiciona os novos itens
  const existingItems = snap.data().items || [];

  await ref.update({
    items: [...existingItems, ...formattedItems],
    updatedAt: new Date(),
  });

  return { created: false, added: formattedItems.length };
}
