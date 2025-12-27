import axios from "axios";

const BASE_URL = `https://api.z-api.io/instances/${process.env.ZAPI_INSTANCE}/token/${process.env.ZAPI_TOKEN}`;
const HEADERS = {
  "Content-Type": "application/json",
  "Client-Token": process.env.ZAPI_CLIENT_TOKEN,
};

/* 💬 TEXTO SIMPLES */
export async function sendMessage(phone, message) {
  if (!message || typeof message !== "string") {
    console.warn("⚠️ Mensagem vazia. Ignorada.");
    return;
  }

  try {
    await axios.post(
      `${BASE_URL}/send-text`,
      { phone, message },
      { headers: HEADERS }
    );
  } catch (err) {
    console.error(
      "❌ Erro ao enviar mensagem:",
      err.response?.data || err.message
    );
  }
}

/* 🔘 BUTTON LIST (Z-API OFICIAL) */
export async function sendButtonList(phone, message, buttons) {
  const payload = {
    phone,
    message,
    buttonList: {
      buttons: buttons.map((b, index) => ({
        id: b.id ?? String(index + 1),
        label: b.title ?? b.label,
      })),
    },
  };

  try {
    const res = await axios.post(`${BASE_URL}/send-button-list`, payload, {
      headers: HEADERS,
    });

    console.log("📤 Z-API BUTTON LIST ENVIADA:", res.data);
  } catch (err) {
    console.error(
      "❌ Erro ao enviar button list:",
      err.response?.data || err.message
    );
  }
}
