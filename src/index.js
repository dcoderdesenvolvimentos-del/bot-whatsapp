import "dotenv/config";
import http from "http";
import { handleWebhook } from "./webhook.js";
import { startScheduler } from "./scheduler.js";

startScheduler();

const server = http.createServer(async (req, res) => {
  // 🔎 Health check (Railway precisa disso)
  if (req.method === "GET" && req.url === "/") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("OK");
    return;
  }

  // 🔔 Webhook Z-API
  if (req.method === "POST") {
    let body = "";

    req.on("data", (chunk) => (body += chunk));

    req.on("end", async () => {
      try {
        const payload = JSON.parse(body);
        await handleWebhook(payload);
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

  // ❌ Qualquer outra rota
  res.writeHead(404);
  res.end();
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Servidor online na porta ${PORT}`);
});
