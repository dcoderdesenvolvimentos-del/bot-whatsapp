// src/services/shoppingListService.js
import { db } from "../firebase.js";

export async function createShoppingListWithItems(
  userId,
  nomeLista = "compras",
  items = []
) {
  const ref = db.collection("shopping_lists").doc(userId);
  const snap = await ref.get();

  const formattedItems = items.map((item) => ({
    name: item.toLowerCase(),
    checked: false,
    createdAt: new Date(),
  }));

  if (!snap.exists) {
    await ref.set({
      nome: nomeLista,
      items: formattedItems,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return { created: true, nomeLista, items: formattedItems };
  }

  const existingData = snap.data();

  await ref.update({
    nome: nomeLista || existingData.nome,
    items: [...(existingData.items || []), ...formattedItems],
    updatedAt: new Date(),
  });

  return { created: false, nomeLista, items: formattedItems };
}

export async function addItemToShoppingList(userId, item) {
  if (!item || typeof item !== "string") {
    console.warn("⚠️ addItemToShoppingList chamado sem item válido:", item);
    return;
  }

  const ref = db.collection("shopping_lists").doc(userId);
  const snap = await ref.get();

  const newItem = {
    name: item.toLowerCase(),
    checked: false,
    createdAt: new Date(),
  };

  if (!snap.exists) {
    await ref.set({
      items: [newItem],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return;
  }

  const existingItems = snap.data().items || [];

  await ref.update({
    items: [...existingItems, newItem],
    updatedAt: new Date(),
  });
}

export async function getShoppingList(userId) {
  const ref = db.collection("shopping_lists").doc(userId);
  const snap = await ref.get();

  if (!snap.exists) {
    return null;
  }

  return snap.data(); // { nome, items }
}

export async function clearShoppingList(userId) {
  const ref = db.collection("shopping_lists").doc(userId);

  await ref.set(
    {
      items: [],
      updatedAt: new Date(),
    },
    { merge: true }
  );
}
