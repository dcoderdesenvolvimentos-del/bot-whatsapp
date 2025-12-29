import axios from "axios";
import crypto from "crypto";

export async function createPixPayment(userPhone) {
  const idempotencyKey = crypto.randomUUID(); // 🔑 OBRIGATÓRIO

  const response = await axios.post(
    "https://api.mercadopago.com/v1/payments",
    {
      transaction_amount: 2, // valor de teste
      description: "Plano Premium Mensal – Bot de Lembretes",
      payment_method_id: "pix",
      payer: {
        email: `user${userPhone}@mariomelembra.com.br`,
        identification: {
          type: "CPF",
          number: "09084315626", // CPF genérico (teste)
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
