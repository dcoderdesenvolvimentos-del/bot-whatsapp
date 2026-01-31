import "dotenv/config";
import http from "http";
import { handleWebhook } from "./webhook.js";
import { startScheduler } from "./scheduler.js";
import { sendMessage } from "./zapi.js";
import { handleMpWebhook } from "./mpWebhook.js";
import admin from "firebase-admin";
import { db } from "./firebase.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

startScheduler();

const server = http.createServer(async (req, res) => {
  // ─────────────────────────────────────
  // 🔐 DASHBOARD MAGIC LOGIN
  // ─────────────────────────────────────

  // 🔓 CORS PRE-FLIGHT
  if (req.method === "OPTIONS") {
    res.writeHead(204, corsHeaders);
    return res.end();
  }

  if (req.method === "POST" && req.url === "/dashboard/magic-login") {
    let body = "";

    req.on("data", (chunk) => (body += chunk));

    req.on("end", async () => {
      try {
        const { slug } = JSON.parse(body);

        if (!slug) {
          res.writeHead(400, corsHeaders);
          return res.end(JSON.stringify({ error: "slug obrigatório" }));
        }

        const snap = await db
          .collection("users")
          .where("dashboardSlug", "==", slug)
          .limit(1)
          .get();

        if (snap.empty) {
          res.writeHead(401, corsHeaders);
          return res.end(JSON.stringify({ error: "slug inválido" }));
        }

        const uid = snap.docs[0].id;
        const token = await admin.auth().createCustomToken(uid);

        res.writeHead(200, {
          "Content-Type": "application/json",
          ...corsHeaders,
        });

        return res.end(JSON.stringify({ token }));
      } catch (err) {
        console.error("magic-login error:", err);
        res.writeHead(500, corsHeaders);
        res.end();
      }
    });

    return;
  }

  // ─────────────────────────────────────
  // 🔔 WEBHOOK MERCADO PAGO
  // ─────────────────────────────────────
  if (req.method === "POST" && req.url === "/mp/webhook") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      try {
        const payload = JSON.parse(body);
        await handleMpWebhook(payload);
        res.writeHead(200);
        res.end("ok");
      } catch (err) {
        console.error("Erro no webhook MP:", err);
        res.writeHead(500);
        res.end("erro");
      }
    });
    return;
  }

  // ─────────────────────────────────────
  // 🤖 WEBHOOK DO WHATSAPP (PADRÃO)
  // ─────────────────────────────────────
  if (req.method === "POST") {
    let body = "";

    req.on("data", (chunk) => (body += chunk));

    req.on("end", async () => {
      try {
        const payload = JSON.parse(body);

        const response = await handleWebhook(payload, sendMessage);
        if (response && payload?.phone) {
          await sendMessage(payload.phone, response);
        }

        res.writeHead(200);
        res.end("ok");
      } catch (err) {
        console.error("Erro no webhook:", err);
        res.writeHead(500);
        res.end("erro");
      }
    });
    return;
  }

  res.writeHead(404);
  res.end();
});

server.listen(3000, () => console.log("🚀 Mário rodando na porta 3000"));
