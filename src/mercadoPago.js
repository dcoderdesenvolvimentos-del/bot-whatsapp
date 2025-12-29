import axios from "axios";
import crypto from "crypto";
import { PLANS } from "./plans.js";

export async function createPixPayment(userPhone, planKey) {
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
      notification_url: "https://SEU_DOMINIO/webhook",

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
