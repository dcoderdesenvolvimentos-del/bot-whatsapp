import { db } from "../firebase.js";
import { Timestamp } from "firebase-admin/firestore";

/**
 * 🔑 Resolve usuário pelo telefone
 * - Se existir → retorna UID
 * - Se não existir → cria e retorna UID
 */

/** export async function getOrCreateUserByPhone(phone) {
  if (!phone) {
    throw new Error("Telefone não informado");
  }

  // 1️⃣ coleção de índice por telefone
  const phoneIndexRef = db.collection("phoneIndex").doc(phone);
  const phoneIndexSnap = await phoneIndexRef.get();

  // 2️⃣ já existe → retorna UID
  if (phoneIndexSnap.exists) {
    return {
      uid: phoneIndexSnap.data().uid,
      phone,
    };
  }

  // 3️⃣ não existe → cria novo usuário
  const userRef = db.collection("users").doc();

  await userRef.set({
    phone,
    createdAt: Timestamp.now(),
    stage: "first_contact",
    active: true,
  });

  // 4️⃣ cria o índice telefone → uid
  await phoneIndexRef.set({
    uid: userRef.id,
    phone,
    createdAt: Timestamp.now(),
  });

  return {
    uid: userRef.id,
    phone,
  };
} */
