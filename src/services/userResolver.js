import { db } from "../firebase.js";
import { Timestamp } from "firebase-admin/firestore";

/**
 * 🔑 Resolve usuário pelo telefone
 * - Se existir → retorna UID
 * - Se não existir → cria e retorna UID
 */
export async function getOrCreateUserByPhone(phone) {
  if (!phone) {
    throw new Error("Telefone não informado");
  }

  // 🔒 BLOQUEIO DEFINITIVO DE PHONES INVÁLIDOS
  const phoneClean = String(phone).trim();

  if (
    phoneClean.includes("@") || // bloqueia @lid, @status etc
    !/^\d{10,15}$/.test(phoneClean) // só números, tamanho válido
  ) {
    throw new Error(`Telefone inválido ignorado: ${phoneClean}`);
  }

  // 1️⃣ índice por telefone
  const phoneIndexRef = db.collection("phoneIndex").doc(phoneClean);
  const phoneIndexSnap = await phoneIndexRef.get();

  // 2️⃣ já existe
  if (phoneIndexSnap.exists) {
    return {
      uid: phoneIndexSnap.data().uid,
      phone: phoneClean,
    };
  }

  // 4️⃣ cria índice
  await phoneIndexRef.set({
    uid: userRef.id,
    phone: phoneClean,
    createdAt: Timestamp.now(),
  });

  return {
    uid: userRef.id,
    phone: phoneClean,
  };
}
