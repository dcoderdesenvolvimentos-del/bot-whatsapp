import admin from "firebase-admin";

// evita inicializar mais de uma vez
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

export const db = admin.firestore();
