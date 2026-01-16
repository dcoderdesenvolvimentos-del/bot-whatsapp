import { audioToText } from "./audio.js";
import { normalizeSpeech } from "./utils/normalizeSpeech.js";
import { sendMessage, sendButtonList } from "./zapi.js";
import { handleMpWebhook } from "./mpWebhook.js";
import { routeIntent } from "./intent/intentRouter.js";
import { getOrCreateUser } from "./services/userService.js";

const processedMessages = new Set();

export async function handleWebhook(payload, sendMessage) {
  if (payload?.action?.includes("payment") || payload?.type === "payment") {
    console.log("🔔 Webhook do Mercado Pago detectado!");
    await handleMpWebhook(payload);
    return null;
  }

  try {
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

    const user = payload.phone;
    let text = "";

    const imageUrl = payload.image?.imageUrl || payload.image?.url || null;
    const hasImage = !!imageUrl;

    if (payload.audio?.audioUrl) {
      console.log("🎤 Áudio recebido");
      const rawText = await audioToText(payload.audio.audioUrl);
      console.log("📝 Texto transcrito (cru):", rawText);
      text = normalizeSpeech(rawText);
      console.log("🧹 Texto normalizado:", text);
    } else if (payload.text?.message) {
      text = payload.text.message.trim();
    } else if (payload.buttonsResponseMessage?.buttonId) {
      text = payload.buttonsResponseMessage.buttonId;
      console.log("🔘 Botão clicado:", text);
    }

    if (!text && !hasImage) {
      console.log("⚠️ Nenhum texto ou imagem processável encontrado.");
      return;
    }

    console.log("👤 User:", user);
    console.log("💬 Texto:", text);

    const userDoc = await getOrCreateUser({ phone: user });
    console.log("🔍 USER DOC ID:", userDoc.id);

    const response = await routeIntent(userDoc.id, text.toLowerCase(), {
      hasImage,
      imageUrl,
    });

    // ✅ TRATAMENTO DE RESPOSTAS
    if (response === null || response === undefined || response === "") {
      console.log("⚠️ Resposta vazia. Ignorada.");
      return;
    }

    // 🔘 Botões
    if (typeof response === "object" && response.type === "buttons") {
      await sendButtonList(user, response.text, response.buttons);
      return;
    }

    // 💳 Pix
    if (typeof response === "object" && response.type === "pix") {
      await sendMessage(user, response.text);
      await sendMessage(user, response.pixCode);
      return;
    }

    // 💬 Mensagem simples (string OU objeto com "message")
    if (typeof response === "string") {
      await sendMessage(user, response);
      return;
    }

    if (typeof response === "object" && response.message) {
      await sendMessage(user, response.message);
      return;
    }

    console.warn("⚠️ Tipo de resposta não tratado:", response);
  } catch (err) {
    console.error("❌ Erro no webhook:", err);
  }
}
