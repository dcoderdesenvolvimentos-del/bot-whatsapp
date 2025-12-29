import axios from "axios";
import crypto from "crypto";
import { PLANS } from "./plans";

export async function createPixPayment(userPhone, planKey) {
  const plan = PLANS[planKey];

  if (!plan) {
    throw new Error(`Plano ${planKey} não encontrado`);
  }

  const idempotencyKey = crypto.randomUUID(); // 🔑 OBRIGATÓRIO

  const response = await axios.post(
    "https://api.mercadopago.com/v1/payments",
    {
      transaction_amount: plan.price, // 👈 USA O PREÇO DO PLANO
      description: `Plano ${plan.label} – Bot de Lembretes`,
      payment_method_id: "pix",
      payer: {
        email: `user${userPhone}@mariomelembra.com.br`,
        identification: {
          type: "CPF",
          number: "09084315626",
        },
      },
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.MERCADO_PAGO_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": idempotencyKey, // 🔥 ESSENCIAL
      },
    }
  );

  return response.data;
}
