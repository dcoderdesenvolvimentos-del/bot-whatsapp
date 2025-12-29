import axios from "axios";

export async function handleMpWebhook(payload) {
  try {
    const paymentId = payload?.data?.id;
    if (!paymentId) return;

    const response = await axios.get(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
        },
      }
    );

    const payment = response.data;

    console.log("🔔 Webhook MP processado");
    console.log("Status:", payment.status);
    console.log("External reference:", payment.external_reference);

    if (payment.status === "approved") {
      // ativar assinatura aqui
    }
  } catch (err) {
    console.error("Erro no webhook Mercado Pago:", err.response?.data || err);
  }
}
