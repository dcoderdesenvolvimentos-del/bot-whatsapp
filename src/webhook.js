import { routeIntent } from "./intentRouter.js";
import { audioToText } from "./audio.js";
import { normalizeSpeech } from "./utils/normalizeSpeech.js";
import { sendMessage, sendButtonList } from "./zapi.js";

// trava anti-duplicação
const processedMessages = new Set();

export async function handleWebhook(payload) {
  try {
    const messageId =
      payload.messageId || payload.zaapId || payload.id || payload?.text?.id;

    if (!messageId) {
      // payload sem ID útil (ack/status/etc)
      return;
    }

    if (processedMessages.has(messageId)) {
      console.log("⚠️ Mensagem duplicada ignorada:", messageId);
      return;
    }

    processedMessages.add(messageId);

    if (!payload || payload.fromMe) return;

    // ignora ACKs, status, edições, etc
    if (
      payload.type === "DeliveryCallback" ||
      payload.type === "ReadCallback" ||
      payload.isEdit ||
      payload.isStatusReply
    ) {
      return;
    }

    const user = payload.phone;
    let text = "";

    // 🔊 ÁUDIO
    if (payload.audio?.audioUrl) {
      console.log("🎤 Áudio recebido");

      const rawText = await audioToText(payload.audio.audioUrl);
      console.log("📝 Texto transcrito (cru):", rawText);

      text = normalizeSpeech(rawText);
      console.log("🧹 Texto normalizado:", text);
    }

    // 📝 TEXTO
    else if (payload.text?.message) {
      text = payload.text.message.trim();
    }

    // 🔘 BOTÃO (Z-API)
    else if (payload.buttonsResponseMessage?.buttonId) {
      text = payload.buttonsResponseMessage.buttonId;
      console.log("🔘 Botão clicado:", text);
    }
    if (!text) {
      console.log("⚠️ Nenhum texto processável encontrado.");
      console.log("📦 Payload recebido:", JSON.stringify(payload, null, 2));
      return;
    }

    console.log("👤 User:", user);
    console.log("💬 Texto:", text);

    // 🔁 CHAMA O ROUTE INTENT
    const response = await routeIntent(user, text.toLowerCase());

    // ⚠️ resposta realmente vazia
    if (response === null || response === undefined || response === "") {
      console.log("⚠️ Resposta vazia. Ignorada.");
      return;
    }

    // 🔘 BUTTON LIST (Z-API)
    if (typeof response === "object" && response.type === "buttons") {
      await sendButtonList(user, response.text, response.buttons);
      return;
    }

    // 💳 PIX
    if (typeof response === "object" && response.type === "pix") {
      await sendMessage(user, response.intro);
      await sendMessage(user, response.code);
      return;
    }

    // 💬 TEXTO NORMAL
    if (typeof response === "string") {
      await sendMessage(user, response);
      return;
    }

    console.warn("⚠️ Tipo de resposta não tratado:", response);
  } catch (err) {
    console.error("❌ Erro no webhook:", err);
  }
}
