import axios from "axios";

export async function handleMpWebhook(req, res) {
  try {
    const paymentId = req.body?.data?.id;

    // Webhook de teste ou inválido
    if (!paymentId) {
      return res.sendStatus(200);
    }

    // 🔎 Busca o pagamento direto na API do Mercado Pago
    const response = await axios.get(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
        },
      }
    );

    const payment = response.data;

    const status = payment.status;
    const externalReference = payment.external_reference;

    console.log("MP payment_id:", paymentId);
    console.log("Status:", status);
    console.log("External reference:", externalReference);

    if (status === "approved") {
      // 👉 ativar assinatura usando externalReference
      // exemplo: user_553391261443_plan_plano_mensal
    }

    return res.sendStatus(200);
  } catch (err) {
    console.error("Erro no webhook Mercado Pago:", err.response?.data || err);
    return res.sendStatus(200); // MP exige 200 sempre
  }
}
