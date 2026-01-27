import { audioToText } from "./audio.js";
import { normalizeSpeech } from "./utils/normalizeSpeech.js";
import { sendMessage, sendButtonList } from "./zapi.js";
import { handleMpWebhook } from "./mpWebhook.js";
import { routeIntent } from "./intent/intentRouter.js";
import { getOrCreateUserByPhone } from "./services/userResolver.js";

const processedMessages = new Set();

export async function handleWebhook(payload) {
  try {
    const phone = payload.phone;
    if (!phone) {
      throw new Error("Telefone não encontrado no payload");
    }

    // 🚫 BLOQUEIO ABSOLUTO
    if (!phone || phone === "status@broadcast" || phone.includes("broadcast")) {
      console.log("🚫 Mensagem de sistema ignorada:", phone);
      return;
    }

    // 🔑 RESOLVE USUÁRIO UMA ÚNICA VEZ
    const { uid } = await getOrCreateUserByPhone(phone);

    // 💳 Webhook Mercado Pago
    if (payload?.action?.includes("payment") || payload?.type === "payment") {
      console.log("🔔 Webhook do Mercado Pago detectado!");
      await handleMpWebhook(payload);
      return;
    }

    const messageId =
      payload.messageId || payload.zaapId || payload.id || payload?.text?.id;

    if (!messageId) return;
    if (processedMessages.has(messageId)) {
      console.log("⚠️ Mensagem duplicada ignorada:", messageId);
      return;
    }
    processedMessages.add(messageId);

    if (!payload || payload.fromMe) return;
    if (
      payload.type === "DeliveryCallback" ||
      payload.type === "ReadCallback" ||
      payload.isEdit ||
      payload.isStatusReply
    ) {
      return;
    }

    let text = "";
    const imageUrl = payload.image?.imageUrl || payload.image?.url || null;
    const hasImage = !!imageUrl;

    if (payload.audio?.audioUrl) {
      console.log("🎤 Áudio recebido");
      const rawText = await audioToText(payload.audio.audioUrl);
      text = normalizeSpeech(rawText);
    } else if (payload.text?.message) {
      text = payload.text.message.trim();
    } else if (payload.buttonsResponseMessage?.buttonId) {
      text = payload.buttonsResponseMessage.buttonId;
    }

    if (!text && !hasImage) return;

    console.log("👤 Phone:", phone);
    console.log("🆔 UID:", uid);
    console.log("💬 Texto:", text);

    // 🚀 CHAMA O CORE COM UID
    const response = await routeIntent(uid, text.toLowerCase(), {
      hasImage,
      imageUrl,
    });

    if (!response) return;

    // 🔘 Botões
    if (typeof response === "object" && response.type === "buttons") {
      await sendButtonList(phone, response.text, response.buttons);
      return;
    }

    // 💳 Pix
    if (typeof response === "object" && response.type === "pix") {
      await sendMessage(phone, response.text);
      await sendMessage(phone, response.pixCode);
      return;
    }

    // 💬 Texto simples
    if (typeof response === "string") {
      await sendMessage(phone, response);
      return;
    }

    if (typeof response === "object" && response.message) {
      await sendMessage(phone, response.message);
      return;
    }

    console.warn("⚠️ Tipo de resposta não tratado:", response);
  } catch (err) {
    console.error("❌ Erro no webhook:", err);
  }
}
