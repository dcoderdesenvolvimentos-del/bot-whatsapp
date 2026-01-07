import { shoppingLists } from "../models/shoppingList.model.js";

export function getUserLists(userId) {
  if (!shoppingLists.has(userId)) {
    shoppingLists.set(userId, {});
  }
  return shoppingLists.get(userId);
}

export function addItem(userId, listName, items) {
  const lists = getUserLists(userId);
  if (!lists[listName]) lists[listName] = [];

  items.forEach(item => {
    if (!lists[listName].some(i => i.item === item)) {
      lists[listName].push({ item, done: false });
    }
  });

  return lists[listName];
}