import { db } from "./firebase.js";
import { audioToText } from "./audio.js";
import { normalizeSpeech } from "./utils/normalizeSpeech.js";
import { sendButtonList } from "./zapi.js";
import { routeIntent } from "./intent/intentRouter.js";
import { getOrCreateUserByPhone } from "./services/userResolver.js";
import { handleBotao } from "./handlers/handleBotao.js";

export async function handleWebhook(payload, sendMessage) {
  try {
    if (!payload) return;

    console.log("📦 PAYLOAD:", JSON.stringify(payload, null, 2));

    /* =========================
       🔘 BOTÕES (PRIORIDADE)
    ========================= */
    if (payload.buttonId) {
      await handleBotao(payload);
      return;
    }

    /* =========================
       📞 VALIDA PHONE
    ========================= */
    const phone = payload.phone;
    if (!phone) {
      console.log("🚫 Payload sem phone");
      return;
    }

    /* =========================
       🤖 IGNORA MENSAGEM DO BOT
    ========================= */
    if (payload.fromMe) return;

    /* =========================
       🔎 VERIFICA CONTEÚDO
    ========================= */
    const hasText =
      typeof payload.text?.message === "string" ||
      typeof payload.buttonsResponseMessage?.buttonId === "string";

    const hasAudio = Boolean(payload.audio?.audioUrl);
    const hasImage = Boolean(payload.image?.imageUrl || payload.image?.url);

    if (!hasText && !hasAudio && !hasImage) {
      console.log("🚫 Evento ignorado (não é mensagem do usuário)");
      return;
    }

    /* =========================
       👤 RESOLVE USUÁRIO
    ========================= */
    const { uid } = await getOrCreateUserByPhone(phone);

    console.log("👤 Phone:", phone);
    console.log("🆔 UID:", uid);

    /* =========================
       ✏️ TEXTO / ÁUDIO
    ========================= */
    let text = "";
    let media = { hasImage: false, imageUrl: null };

    if (hasAudio) {
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

    /* =========================
       🔁 ANTI-DUPLICAÇÃO
    ========================= */
    const messageId = payload.messageId;
    if (messageId) {
      const alreadyProcessed = await hasProcessedMessage(messageId);
      if (alreadyProcessed) {
        console.log("🔁 Mensagem duplicada ignorada:", messageId);
        return;
      }

      await markMessageAsProcessed(messageId);
    }

    /* =========================
       🧠 ROUTER (DECISÃO)
    ========================= */
    const response = await routeIntent(uid, text.toLowerCase(), media);
    if (!response) return;

    /* =========================
       📤 ENVIO
    ========================= */
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

/* =========================
   🧱 HELPERS ANTI-DUP
========================= */

async function markMessageAsProcessed(messageId) {
  await db.collection("processedMessages").doc(messageId).set({
    processedAt: new Date(),
  });
}

async function hasProcessedMessage(messageId) {
  const doc = await db.collection("processedMessages").doc(messageId).get();
  return doc.exists;
}
