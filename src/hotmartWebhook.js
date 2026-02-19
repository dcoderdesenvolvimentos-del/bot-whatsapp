import { db } from "./firebase.js";
import { Timestamp } from "firebase-admin/firestore";

export async function handleHotmartWebhook(data) {
  console.log("🔥 WEBHOOK HOTMART:", JSON.stringify(data, null, 2));

  const status = data.status;
  const email = data.buyer?.email;
  const offerCode = data.offer?.code;
  const uid = payload.custom?.sck;

  if (!email) return;

  // 🔎 Buscar usuário pelo email
  const snap = await db
    .collection("users")
    .where("email", "==", email)
    .limit(1)
    .get();

  if (snap.empty) {
    console.log("Usuário não encontrado para email:", email);
    return;
  }

  const userDoc = snap.docs[0];
  const userRef = userDoc.ref;

  if (status === "APPROVED") {
    let meses = 1;

    switch (offerCode) {
      case "duvis1r2":
        meses = 1;
        break;

      case "niiuxczq":
        meses = 3;
        break;

      case "a32e6pq7":
        meses = 6;
        break;

      case "ue2sn1ve":
        meses = 12;
        break;
    }

    const expires = new Date();
    expires.setMonth(expires.getMonth() + meses);

    await userRef.update({
      premium: true,
      expiresAt: Timestamp.fromDate(expires),
    });

    console.log("✅ Premium ativado:", email);
  }
  await db
    .collection("users")
    .doc(uid)
    .update({
      premium: true,
      expiresAt: Timestamp.fromDate(novaData),
    });
}
