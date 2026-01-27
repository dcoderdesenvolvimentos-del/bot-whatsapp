import { db } from "../config/firebase.js";
import { Timestamp } from "firebase-admin/firestore";

/**
 * 🔐 Resolve usuário REAL pelo telefone
 * REGRA: 1 telefone limpo = 1 UID
 */
export async function getOrCreateUserByPhone(rawPhone) {
  // 1️⃣ validação básica
  if (!rawPhone || typeof rawPhone !== "string") {
    return null;
  }

  // 2️⃣ ignora eventos que NÃO são usuários
  if (
    rawPhone === "status@broadcast" ||
    rawPhone.endsWith("@broadcast") ||
    rawPhone.endsWith("@lid")
  ) {
    return null;
  }

  // 3️⃣ normaliza telefone (SÓ NÚMEROS)
  const phone = rawPhone.replace(/\D/g, "");

  if (phone.length < 8) {
    return null;
  }

  // 4️⃣ phoneIndex é a fonte da verdade
  const phoneIndexRef = db.collection("phoneIndex").doc(phone);
  const phoneIndexSnap = await phoneIndexRef.get();

  // 5️⃣ já existe → retorna UID
  if (phoneIndexSnap.exists) {
    return {
      uid: phoneIndexSnap.data().uid,
      phone,
    };
  }

  // 6️⃣ cria novo usuário (ÚNICO LUGAR QUE CRIA)
  const userRef = db.collection("users").doc();

  await userRef.set({
    phone,
    stage: "first_contact",
    active: true,
    createdAt: Timestamp.now(),
  });

  await phoneIndexRef.set({
    uid: userRef.id,
    phone,
    createdAt: Timestamp.now(),
  });

  return {
    uid: userRef.id,
    phone,
  };
}
