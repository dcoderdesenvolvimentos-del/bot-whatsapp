import express from "express";
import { routeIntent } from "./intent/intentRouter.js";

const router = express.Router();

router.post("/webhook", async (req, res) => {
  try {
    const payload = req.body;

    const userId =
      payload.phone ||
      payload.from ||
      payload.sender ||
      payload.message?.phone ||
      null;

    const text = payload.message?.text || "";
    const imageUrl = payload.message?.image?.url || null;

    console.log("📩 Z-API WEBHOOK:", {
      userId,
      text,
      imageUrl,
    });

    await routeIntent(userId, text, {
      hasImage: !!imageUrl,
      imageUrl,
    });

    return res.sendStatus(200);
  } catch (err) {
    console.error("❌ Erro webhook Z-API:", err);
    return res.sendStatus(500);
  }
});

export default router;
