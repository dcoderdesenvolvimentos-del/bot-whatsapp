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

  // 1️⃣ índice telefone → uid
  const phoneIndexRef = db.collection("phoneIndex").doc(phoneClean);
  const phoneIndexSnap = await phoneIndexRef.get();

  // 2️⃣ se já existe, RETORNA
  if (phoneIndexSnap.exists) {
    return {
      uid: phoneIndexSnap.data().uid,
      phone: phoneClean,
    };
  }

  // 3️⃣ cria UID UMA ÚNICA VEZ
  const userRef = db.collection("users").doc(); // ok aqui, só aqui

  await userRef.set({
    phone: phoneClean,
    createdAt: Timestamp.now(),
    stage: "first_contact",
    active: true,
  });

  // 4️⃣ cria o índice (ESSENCIAL)
  await phoneIndexRef.set({
    uid: userRef.id,
    createdAt: Timestamp.now(),
  });

  return {
    uid: userRef.id,
    phone: phoneClean,
  };
}
