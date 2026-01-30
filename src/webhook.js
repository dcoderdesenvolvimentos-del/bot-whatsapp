import { db } from "./firebase.js";
import { audioToText } from "./audio.js";
import { normalizeSpeech } from "./utils/normalizeSpeech.js";
import { sendButtonList } from "./zapi.js";
import { routeIntent } from "./intent/intentRouter.js";
import { getOrCreateUserByPhone } from "./services/userResolver.js";
import { extrairTextoDaImagem } from "./services/vision.js";
import { handleGastoPorNotificacao } from "./handlers/gastoNotificacao.js";

const processedMessages = new Set();

export async function handleWebhook(payload, sendMessage) {
  if (payload.image?.imageUrl) {
    const textoOCR = await extrairTextoDaImagem(payload.image.imageUrl);

    const classificacao = await classificarImagemOCR(textoOCR);

    await updateUser(userDocId, {
      ultimaImagem: {
        tipo: classificacao.tipo,
        ocr: textoOCR,
        imageUrl: payload.image.imageUrl,
        criadaEm: new Date(),
      },
    });
  }
  if (payload.buttonId) {
    await handleBotao(payload);
    return;
  }

  console.log("📦 PAYLOAD:", JSON.stringify(payload, null, 2));
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
      typeof payload.text?.message === "string" ||
      typeof payload.buttonsResponseMessage?.buttonId === "string" ||
      typeof payload.audio?.audioUrl === "string";

    if (!hasText && !payload.image?.imageUrl) {
      console.log("🚫 Evento ignorado (não é mensagem do usuário)");
      return;
    }

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

    if (typeof text !== "string") {
      text = "";
    }

    if (hasImage) {
      media = {
        hasImage: true,
        imageUrl: payload.image?.imageUrl || payload.image?.url,
      };
    }

    if (!text && !media.hasImage) return;

    console.log("💬 Texto:", text);

    // TRAVA ANTI-DUPLICAÇÃO
    const messageId = payload.messageId;
    if (messageId) {
      const alreadyProcessed = await hasProcessedMessage(messageId);
      if (alreadyProcessed) {
        console.log("🔁 Mensagem duplicada ignorada:", messageId);
        return;
      }

      await markMessageAsProcessed(messageId);
    }
    async function markMessageAsProcessed(messageId) {
      await db.collection("processedMessages").doc(messageId).set({
        processedAt: new Date(),
      });
    }

    async function hasProcessedMessage(messageId) {
      const doc = await db.collection("processedMessages").doc(messageId).get();
      return doc.exists;
    }

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
