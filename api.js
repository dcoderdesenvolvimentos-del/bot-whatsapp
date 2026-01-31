import express from "express";
import cors from "cors";
import admin from "./firebaseAdmin.js";
import { db } from "./config/firebase.js";

const app = express();

app.use(cors());
app.use(express.json());

/**
 * 🔐 MAGIC LOGIN
 */
app.post("/dashboard/magic-login", async (req, res) => {
  try {
    const { slug } = req.body;

    if (!slug) {
      return res.status(400).json({ error: "slug obrigatório" });
    }

    const snap = await db
      .collection("users")
      .where("dashboardSlug", "==", slug)
      .limit(1)
      .get();

    if (snap.empty) {
      return res.status(401).json({ error: "slug inválido" });
    }

    const uid = snap.docs[0].id;

    const token = await admin.auth().createCustomToken(uid);

    return res.json({ token });
  } catch (err) {
    console.error("magic-login:", err);
    return res.status(500).json({ error: "erro interno" });
  }
});

export default app;
