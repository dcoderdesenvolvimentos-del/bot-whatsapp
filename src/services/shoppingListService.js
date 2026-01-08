import { db } from "../firebase.js";
import { slugify } from "../utils/textUtils.js";

/**
 * Cria uma nova lista (se não existir)
 */
export async function createList(userId, nomeLista) {
  const listaId = slugify(nomeLista);

  const ref = db
    .collection("shopping_lists")
    .doc(userId)
    .collection("listas")
    .doc(listaId);

  const snap = await ref.get();

  if (!snap.exists) {
    await ref.set({
      nome: nomeLista,
      items: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  return listaId;
}

export async function addItemsToList(userId, listaId, items = []) {
  if (!items.length) return;

  const ref = db
    .collection("shopping_lists")
    .doc(userId)
    .collection("listas")
    .doc(listaId);

  const snap = await ref.get();
  if (!snap.exists) return;

  const novos = items.map((item) => ({
    name: item.toLowerCase(),
    checked: false,
    createdAt: new Date(),
  }));

  await ref.update({
    items: [...snap.data().items, ...novos],
    updatedAt: new Date(),
  });
}

/**
 * Adiciona itens em uma lista específica
 */
export async function addItemsToSpecificList(userId, listaId, items = []) {
  if (!items.length) return;

  const ref = db
    .collection("shopping_lists")
    .doc(userId)
    .collection("listas")
    .doc(listaId);

  const snap = await ref.get();
  if (!snap.exists) return;

  const existentes = snap.data().items || [];

  const novos = items.map((item) => ({
    name: item.toLowerCase(),
    checked: false,
    createdAt: new Date(),
  }));

  await ref.update({
    items: [...existentes, ...novos],
    updatedAt: new Date(),
  });
}

/**
 * Busca uma lista específica
 */
export async function getList(userId, listaId) {
  const ref = db
    .collection("shopping_lists")
    .doc(userId)
    .collection("listas")
    .doc(listaId);

  const snap = await ref.get();
  return snap.exists ? snap.data() : null;
}

/**
 * Lista todas as listas do usuário
 */
export async function getAllLists(userId) {
  const ref = db.collection("shopping_lists").doc(userId).collection("listas");

  const snap = await ref.get();

  return snap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
}

/**
 * Remover itens de uma lista específica
 */
export async function removeItemsFromList(userId, listaId, itemsToRemove = []) {
  if (!itemsToRemove.length) return;

  const ref = db
    .collection("shopping_lists")
    .doc(userId)
    .collection("listas")
    .doc(listaId);

  const snap = await ref.get();
  if (!snap.exists) return;

  const filtrados = (snap.data().items || []).filter(
    (item) => !itemsToRemove.includes(item.name)
  );

  await ref.update({
    items: filtrados,
    updatedAt: new Date(),
  });
}

/**
 * 🗑️ Excluir lista inteira
 */
export async function deleteList(userId, listaId) {
  const ref = db
    .collection("shopping_lists")
    .doc(userId)
    .collection("listas")
    .doc(listaId);

  await ref.delete();
}
