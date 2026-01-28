import { audioToText } from "./audio.js";
import { normalizeSpeech } from "./utils/normalizeSpeech.js";
import { sendMessage, sendButtonList } from "./zapi.js";
import { handleMpWebhook } from "./mpWebhook.js";
import { routeIntent } from "./intent/intentRouter.js";
import { getOrCreateUserByPhone } from "./services/userResolver.js";

const processedMessages = new Set();
export async function handleWebhook(payload, sendMessage) {
  try {
    // 1️⃣ valida payload
    if (!payload) return;

    const phone = payload.phone;
    if (!phone) {
      console.log("🚫 Payload sem phone");
      return;
    }

    // 2️⃣ ignora mensagens do próprio bot
    if (payload.fromMe) return;

    // 3️⃣ ignora eventos sem texto, áudio ou imagem
    const hasText =
      payload.text?.message || payload.buttonsResponseMessage?.buttonId;

    const hasAudio = payload.audio?.audioUrl;
    const hasImage = payload.image?.imageUrl || payload.image?.url;

    if (!hasText && !hasAudio && !hasImage) {
      console.log("🚫 Evento ignorado (não é mensagem do usuário)");
      return;
    }

    // 4️⃣ resolve usuário (AQUI é o lugar certo)
    const { uid } = await getOrCreateUserByPhone(phone);

    console.log("👤 Phone:", phone);
    console.log("🆔 UID:", uid);

    // 5️⃣ extrai texto
    let text = "";
    let media = { hasImage: false, imageUrl: null };

    if (payload.audio?.audioUrl) {
      console.log("🎤 Áudio recebido");
      const rawText = await audioToText(payload.audio.audioUrl);
      text = normalizeSpeech(rawText);
    } else if (payload.text?.message) {
      text = payload.text.message.trim();
    } else if (payload.buttonsResponseMessage?.buttonId) {
      text = payload.buttonsResponseMessage.buttonId;
    }

    if (hasImage) {
      media = {
        hasImage: true,
        imageUrl: payload.image?.imageUrl || payload.image?.url,
      };
    }

    if (!text && !media.hasImage) return;

    console.log("💬 Texto:", text);

    // 6️⃣ chama o router
    const response = await routeIntent(uid, text.toLowerCase(), media);

    if (!response) return;

    // 7️⃣ envia resposta
    if (typeof response === "string") {
      await sendMessage(phone, response);
      return;
    }

    if (response.type === "buttons") {
      await sendButtonList(phone, response.text, response.buttons);
      return;
    }

    if (response.type === "pix") {
      await sendMessage(phone, response.text);
      await sendMessage(phone, response.pixCode);
      return;
    }
  } catch (err) {
    console.error("❌ Erro no webhook:", err);
  }
}
