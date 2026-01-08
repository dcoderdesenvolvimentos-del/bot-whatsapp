import { shoppingLists } from "../models/shoppingList.model.js";

function getUserLists(userId) {
  if (!shoppingLists.has(userId)) {
    shoppingLists.set(userId, {});
  }
  return shoppingLists.get(userId);
}

// ✅ ADICIONE ISSO
export function createList(userId, listName) {
  const lists = getUserLists(userId);

  if (!lists[listName]) {
    lists[listName] = [];
  }

  return lists[listName];
}

export function addItem(userId, listName, items = []) {
  const lists = getUserLists(userId);
  if (!lists[listName]) lists[listName] = [];

  items.forEach((item) => {
    if (!lists[listName].some((i) => i.item === item)) {
      lists[listName].push({ item, done: false });
    }
  });
}

export function listItems(userId, listName) {
  const lists = getUserLists(userId);
  const list = lists[listName] || [];

  if (list.length === 0) {
    return "🛒 Sua lista está vazia.";
  }

  return (
    `🛒 *Lista: ${listName}*\n\n` +
    list.map((i) => `${i.done ? "✅" : "⬜"} ${i.item}`).join("\n")
  );
}

export function removeItem(userId, listName, item) {
  const lists = getUserLists(userId);
  if (!lists[listName]) return;

  lists[listName] = lists[listName].filter((i) => i.item !== item);
}

export function markDone(userId, listName, item) {
  const lists = getUserLists(userId);
  if (!lists[listName]) return;

  const found = lists[listName].find((i) => i.item === item);
  if (found) found.done = true;
}

export function clearList(userId, listName) {
  const lists = getUserLists(userId);
  lists[listName] = [];
}
