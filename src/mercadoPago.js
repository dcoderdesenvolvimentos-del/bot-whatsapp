import axios from "axios";
import crypto from "crypto";
import { PLANS } from "./plans.js";

import { MercadoPagoConfig, Payment } from "mercadopago";

// cria o cliente com o token
const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN,
});

// instancia o serviço de pagamento
const payment = new Payment(client);

// 🔥 EXPORT NOMEADO (é isso que o outro arquivo espera)
export { payment };

export async function createPixPayment(userPhone, planKey) {
  mercadopago.configure({
    access_token: process.env.MP_ACCESS_TOKEN,
  });

  const plan = PLANS[planKey];
  if (!plan) {
    throw new Error(`Plano ${planKey} não encontrado`);
  }

  const idempotencyKey = crypto.randomUUID();

  const response = await axios.post(
    "https://api.mercadopago.com/v1/payments",
    {
      transaction_amount: plan.price,
      description: `Plano ${plan.label} – Bot de Lembretes`,
      payment_method_id: "pix",

      // 🔥 OBRIGATÓRIO PARA STATUS FUNCIONAR
      notification_url:
        "https://bot-whatsapp-production-0c8c.up.railway.app/mp/webhook",

      // 🔎 Rastreio interno (ajuda MUITO na aprovação)
      external_reference: `user_${userPhone}_plan_${planKey}`,

      payer: {
        email: `user${userPhone}@mariomelembra.com.br`,
        identification: {
          type: "CPF",
          number: "09084315626", // pode manter fixo por enquanto
        },
      },

      // 🔥 MUITO IMPORTANTE PARA AVALIAÇÃO DA APLICAÇÃO
      additional_info: {
        items: [
          {
            id: planKey,
            title: plan.label,
            description: "Assinatura Bot de Lembretes",
            quantity: 1,
            unit_price: plan.price,
          },
        ],
      },
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.MERCADO_PAGO_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": idempotencyKey,
      },
    }
  );

  return {
    payment_id: response.data.id,
    status: response.data.status,
    pix_copia_e_cola:
      response.data.point_of_interaction.transaction_data.qr_code,
    qr_code_base64:
      response.data.point_of_interaction.transaction_data.qr_code_base64,
  };
}
