import axios from "axios";
import { PLANS } from "./plans.js";
import { getUser, updateUser } from "./services/userService.js";
import { sendMessage } from "./zapi.js";

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
      },
    );

    const payment = response.data;

    console.log("🔔 Webhook MP processado");
    console.log("Status:", payment.status);
    console.log("External reference:", payment.external_reference);

    if (payment.status !== "approved") return;

    // 👇 EXTRAI O PHONE DO EXTERNAL REFERENCIA
    const ref = payment.external_reference;
    const userPhone = ref.match(/user_(\d+)_/)?.[1];

    if (!userPhone) {
      console.error(
        "❌ Não conseguiu extrair o telefone do external_reference",
      );
      return;
    }

    const userData = await getUser(userPhone);

    if (!userData || !userData.pendingPlan) {
      console.error("❌ Usuário não encontrado ou sem plano pendente");
      return;
    }

    const plan = PLANS[userData.pendingPlan];
    const premiumUntil = Date.now() + plan.days * 24 * 60 * 60 * 1000;

    await updateUser(userPhone, {
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

    console.log(`✅ Plano ${userData.pendingPlan} ativado para ${userPhone}`);

    // 🎉 MENSAGEM PÓS-PAGAMENTO
    await sendMessage(
      userPhone,
      "🎉 *Pagamento confirmado com sucesso!*\n\n" +
        "💎 Seu *Plano Premium* já está ativo.\n\n" +
        "Agora você pode criar *lembretes ilimitados* e usar o bot sem restrições.\n\n" +
        "👉 Pode começar agora mesmo. É só me dizer 😊",
    );
  } catch (err) {
    console.error("Erro no webhook Mercado Pago:", err.response?.data || err);
  }
}
