import { db } from "./firebase.js";
import { audioToText } from "./audio.js";
import { normalizeSpeech } from "./utils/normalizeSpeech.js";
import { sendButtonList } from "./zapi.js";
import { routeIntent } from "./intent/intentRouter.js";
import { getOrCreateUserByPhone } from "./services/userResolver.js";
import { temAcesso } from "./utils/access.js";
import { sendTyping, stopTyping } from "./zapi.js";

const processedMessages = new Set();

export async function handleWebhook(payload, sendMessage) {
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
    if (payload.type !== "ReceivedCallback") {
      return;
    }

    // 4️⃣ resolve usuário (AQUI é o lugar certo)
    const userData = await getOrCreateUserByPhone(phone);

    if (!userData) {
      console.log("🚫 Usuário não resolvido:", phone);
      return;
    }

    const { uid } = userData;

    console.log("USER RESOLVER:", userData);

    if (!userData) {
      console.log("USUÁRIO NÃO RESOLVIDO");
      return;
    }

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

    // 🔒 VERIFICA ACESSO (trial ou premium)
    const userSnap = await db.collection("users").doc(uid).get();
    const user = userSnap.data();

    const buttonText = String(text).trim().toUpperCase();

    const clicouEmPlano =
      buttonText === "PLANO_MENSAL" ||
      buttonText === "PLANO_TRIMESTRAL" ||
      buttonText === "PLANO_SEMESTRAL" ||
      buttonText === "PLANO_ANUAL";

    if (!temAcesso(user) && !clicouEmPlano) {
      const premiumMessage = {
        type: "buttons",
        text:
          "🔒 *Seu acesso gratuito terminou.*\n\n" +
          "Você já começou a organizar sua vida com o Mário.\n\n" +
          "Não perca seus:\n" +
          "✅ Lembretes\n" +
          "✅ Controle financeiro\n" +
          "✅ Dashboard online\n\n" +
          "Escolha um plano para continuar 👇",
        buttons: [
          { id: "PLANO_MENSAL", label: "Mensal — R$ 17,99" },
          { id: "PLANO_TRIMESTRAL", label: "Trimestral — R$ 47,90" },
          {
            id: "PLANO_SEMESTRAL",
            label: "Semestral — R$ 87,99 🔥",
          },
          {
            id: "PLANO_ANUAL",
            label: "Anual — R$ 151,99 💰",
          },
        ],
      };

      await sendButtonList(phone, premiumMessage.text, premiumMessage.buttons);
      return;
    }

    console.log("PASSOU DA VERIFICAÇÃO");

    // 🧠 ATIVA DIGITANDO
    await sendTyping(phone);

    // mantém ativo (IMPORTANTE)
    setTimeout(() => sendTyping(phone), 1000);

    // 🧠 PROCESSA
    const response = await routeIntent(uid, text.toLowerCase(), media);
    console.log("ROUTER RESPONSE:", response);

    if (!response) return;

    // ⏱ tempo humano
    const delay = (ms) => new Promise((res) => setTimeout(res, ms));
    const tempo = Math.min(2000, String(response).length * 25);
    await delay(tempo);

    // 🛑 para digitando
    await stopTyping(phone);

    // 📤 ENVIO (mantém sua lógica original)
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
