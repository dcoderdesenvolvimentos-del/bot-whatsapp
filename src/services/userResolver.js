import { db } from "../config/firebase.js";
import { Timestamp } from "firebase-admin/firestore";
import crypto from "crypto";

function gerarSlug() {
  return crypto.randomBytes(4).toString("hex");
}

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

  // 3️⃣ normaliza telefone
  const phone = rawPhone.replace(/\D/g, "");
  if (phone.length < 8) {
    return null;
  }

  // 4️⃣ consulta índice
  const phoneIndexRef = db.collection("phoneIndex").doc(phone);
  const phoneIndexSnap = await phoneIndexRef.get();

  // ─────────────────────────────────────────
  // 🟢 CASO 1: USUÁRIO JÁ EXISTE
  // ─────────────────────────────────────────
  if (phoneIndexSnap.exists) {
    const uid = phoneIndexSnap.data().uid;
    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      return null; // algo muito errado aconteceu
    }

    const userData = userSnap.data();

    // 🔥 AQUI ENTRA O SLUG (USUÁRIO ANTIGO)
    if (!userData.dashboardSlug) {
      const slug = gerarSlug();
      await userRef.update({
        dashboardSlug: slug,
      });
      userData.dashboardSlug = slug;
    }

    return {
      uid,
      phone,
      dashboardSlug: userData.dashboardSlug,
    };
  }

  // ─────────────────────────────────────────
  // 🟢  CASO 2: USUÁRIO NOVO
  // ─────────────────────────────────────────
  const slug = gerarSlug();
  const userRef = db.collection("users").doc();

  // 🎁 CRIA TRIAL DE 2 DIAS
  const agora = new Date();
  const trial = new Date();
  trial.setDate(agora.getDate() + 2);

  await userRef.set({
    phone,
    dashboardSlug: slug,
    stage: "ghost",
    active: true,

    // 🔥 SISTEMA DE ACESSO
    premium: false,
    trialEndsAt: Timestamp.fromDate(trial),
    expiresAt: null,
    trialWarningSent: false,
    trialExpiredNotified: false,

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
    dashboardSlug: slug,
  };
}
