import "dotenv/config";

import http from "http";
import { handleWebhook } from "./webhook.js";
import { startScheduler } from "./scheduler.js";
import { sendMessage } from "./zapi.js";

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
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Webhook rodando na porta ${PORT}`);
});
