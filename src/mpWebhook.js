import axios from "axios";
import { PLANS } from "./plans.js";
import { getUser, updateUser } from "./services/userService.js";

export async function handleMpWebhook(req, res) {
  console.log("🔔 MP Webhook recebido:", JSON.stringify(req.body, null, 2));
  const paymentId = req.body.data?.id;
  if (!paymentId) return res.sendStatus(200);

  const { data } = await axios.get(
    `https://api.mercadopago.com/v1/payments/${paymentId}`,
    {
      headers: {
        Authorization: `Bearer ${process.env.MERCADO_PAGO_ACCESS_TOKEN}`,
      },
    }
  );

  if (data.status !== "approved") return res.sendStatus(200);

  const user = data.payer.email.replace("@mariomelembra.com.br", "");
  const userData = await getUser(user);

  const plan = PLANS[userData.pendingPlan];
  const premiumUntil = Date.now() + plan.days * 24 * 60 * 60 * 1000;

  await updateUser(user, {
    plan: "premium",
    planType: userData.pendingPlan,
    premiumUntil,
    pendingPayment: null,
    pendingPlan: null,
    expirationWarnings: {
      sevenDays: false,
      oneDay: false,
    },
  });

  console.log("💰 Status pagamento:", data.status);

  // 🎉 MENSAGEM PÓS-PAGAMENTO
  await sendMessage(
    user,
    "🎉 *Pagamento confirmado com sucesso!*\n\n" +
      "💎 Seu *Plano Premium* já está ativo.\n\n" +
      "Agora você pode criar *lembretes ilimitados* e usar o bot sem restrições.\n\n" +
      "👉 Pode começar agora mesmo. É só me dizer 😊"
  );

  res.sendStatus(200);
}
