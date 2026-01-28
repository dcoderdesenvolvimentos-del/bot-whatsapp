import { db } from "../firebase.js";

/**
 * 📦 Lista todas as listas do usuário
 */
export async function listarTodasListas(userId) {
  const snapshot = await db
    .collection("users")
    .doc(userId)
    .collection("listas")
    .where("user", "==", userId) // ⚠️ ajuste se o campo for phone/userId
    .get();

  if (snapshot.empty) {
    return [];
  }

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    nome: doc.data().nome,
  }));
}
