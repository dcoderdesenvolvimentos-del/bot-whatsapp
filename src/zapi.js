import axios from "axios";

const BASE_URL = `https://api.z-api.io/instances/${process.env.ZAPI_INSTANCE}/token/${process.env.ZAPI_TOKEN}`;
const HEADERS = {
  "Content-Type": "application/json",
  "Client-Token": process.env.ZAPI_CLIENT_TOKEN,
};

/* 💬 TEXTO SIMPLES OU BOTÕES */
export async function sendMessage(phone, message) {
  // 🔘 Se for objeto com botões
  if (typeof message === "object" && message.type === "buttons") {
    return await sendButtonList(phone, message.text, message.buttons);
  }

  // 📝 Texto simples
  if (!message || typeof message !== "string") {
    console.warn("⚠️ Mensagem vazia. Ignorada.");
    return;
  }

  try {
    await axios.post(
      `${BASE_URL}/send-text`,
      { phone, message },
      { headers: HEADERS },
    );
  } catch (err) {
    console.error(
      "❌ Erro ao enviar mensagem:",
      err.response?.data || err.message,
    );
  }
}

/* 🔘 BUTTON LIST (Z-API OFICIAL) */
export async function sendButtonList(phone, message, buttons) {
  const payload = {
    phone,
    message,
    buttonList: {
      buttons: buttons.map((b) => ({
        id: b.id || b.text,
        label: b.text || b.label,
      })),
    },
  };

  try {
    const res = await axios.post(`${BASE_URL}/send-button-list`, payload, {
      headers: HEADERS,
    });

    console.log("📤 BOTÕES ENVIADOS:", res.data);
    return res.data;
  } catch (err) {
    console.error(
      "❌ Erro ao enviar botões:",
      err.response?.data || err.message,
    );
  }
}

export async function sendTyping(phone) {
  try {
    await axios.post(
      `${BASE_URL}/send-presence`,
      {
        phone,
        presence: "composing",
      },
      { headers: HEADERS },
    );
  } catch (err) {
    console.error("❌ typing:", err.response?.data || err.message);
  }
}

export async function stopTyping(phone) {
  try {
    await axios.post(
      `${BASE_URL}/send-presence`,
      {
        phone,
        presence: "paused",
      },
      { headers: HEADERS },
    );
  } catch (err) {
    console.error("❌ stop typing:", err.response?.data || err.message);
  }
}
