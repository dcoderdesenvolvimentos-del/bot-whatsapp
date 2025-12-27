import admin from "firebase-admin";
import fs from "fs";

const serviceAccount = JSON.parse(
  fs.readFileSync("serviceAccountKey.json", "utf8")
);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

console.log("🔥 Firebase app:", admin.apps[0]?.options?.credential?.projectId);

export const db = admin.firestore();

console.log("🗄️ Firestore DB:", db._settings?.databaseId);
