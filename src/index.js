import "dotenv/config";

import http from "http";
import { handleWebhook } from "./webhook.js";
import { startScheduler } from "./scheduler.js";
import { sendMessage } from "./zapi.js";
import { handleMpWebhook } from "./mpWebhook.js";

startScheduler();

const server = http.createServer(async (req, res) => {
  if (req.method === "POST") {
    let body = "";

    req.on("data", (chunk) => (body += chunk));

    req.on("end", async () => {
      try {
        const payload = JSON.parse(body);

        const response = await handleWebhook(payload, sendMessage);
        // 🔥 AQUI ESTÁ A DIFERENÇA
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
  } else {
    res.writeHead(404);
    res.end();
  }

  // 🔔 WEBHOOK MERCADO PAGO
  if (req.method === "POST" && req.url === "/mp/webhook") {
    return handleMpWebhook(req, res);
  }
});

server.listen(3000, () => console.log("Webhook rodando na porta 3000"));
