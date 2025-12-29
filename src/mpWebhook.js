import axios from "axios";
import { getUserByPendingPayment, updateUser } from "./services/userService.js";
import { sendMessage } from "./zapi.js";
import { payment } from "./mercadoPago.js";

export async function handleMpWebhook(payload) {
  const paymentId = Number(payload?.data?.id);
  if (!paymentId) return;

  console.log("🧾 MP paymentId:", paymentId);

  const { data } = await axios.get(
    `https://api.mercadopago.com/v1/payments/${paymentId}`,
    {
      headers: {
        Authorization: `Bearer ${process.env.MERCADO_PAGO_ACCESS_TOKEN}`,
      },
    }
  );
  // ✅ AQUI você define o payment
  const payment = await mercadopago.payment.findById(paymentId);
  const externalReference = mpPayment.external_reference;

  // ✅ SDK NOVO
  const mpPayment = await payment.get({ id: paymentId });

  const status = mpPayment.status;

  console.log("Status:", status);
  console.log("External reference:", externalReference);

  if (status === "approved") {
    // ativar assinatura aqui
  }

  console.log("💳 Status do pagamento:", data.status); // 👈 ADICIONA AQUI

  if (data.status !== "approved") {
    console.log("⏳ Pagamento ainda não aprovado, aguardando..."); // 👈 E AQUI
    return;
  }

  const userData = await getUserByPendingPayment(paymentId);
  if (!userData) {
    console.log("❌ Usuário não encontrado para paymentId", paymentId);
    return;
  }

  const premiumUntil = Date.now() + 30 * 24 * 60 * 60 * 1000;
  // 🔥 VALIDAÇÃO OBRIGATÓRIA
  if (!pix?.payment_id) {
    throw new Error("PIX criado sem payment_id");
  }
  await updateUser(userData.id, {
    plan: "premium",
    premiumUntil,
    pendingPayment: null,
    pendingPlan: null,
  });

  await sendMessage(
    userData.id,
    "🎉 *Pagamento confirmado!*\n\n" +
      "💎 Seu plano Premium já está ativo.\n\n" +
      "Obrigado por confiar no Mário 🤝"
  );

  console.log("✅ Usuário virou Premium:", userData.id);
}
