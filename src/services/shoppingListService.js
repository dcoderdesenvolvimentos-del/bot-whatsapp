// services/shoppingListService.js
import { db } from "../firebase.js";

export async function createShoppingListWithItems(userId, items = []) {
  const ref = doc(db, "shopping_lists", userId);
  const snap = await getDoc(ref);

  const formattedItems = items.map((item) => ({
    name: item.toLowerCase(),
    checked: false,
    createdAt: new Date(),
  }));

  if (!snap.exists()) {
    await setDoc(ref, {
      items: formattedItems,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return { created: true, added: formattedItems.length };
  }

  if (formattedItems.length) {
    await updateDoc(ref, {
      items: arrayUnion(...formattedItems),
      updatedAt: new Date(),
    });
  }

  return { created: false, added: formattedItems.length };
}

export async function addItemToShoppingList(userId, item) {
  const ref = doc(db, "shopping_lists", userId);
  const snap = await getDoc(ref);

  const newItem = {
    name: item.toLowerCase(),
    checked: false,
    createdAt: new Date(),
  };

  if (!snap.exists()) {
    await setDoc(ref, {
      items: [newItem],
      updatedAt: new Date(),
    });
  } else {
    await updateDoc(ref, {
      items: arrayUnion(newItem),
      updatedAt: new Date(),
    });
  }
}

export async function getShoppingList(userId) {
  const ref = doc(db, "shopping_lists", userId);
  const snap = await getDoc(ref);

  if (!snap.exists()) return [];

  return snap.data().items || [];
}

export async function clearShoppingList(userId) {
  const ref = doc(db, "shopping_lists", userId);
  await setDoc(ref, {
    items: [],
    updatedAt: new Date(),
  });
}
