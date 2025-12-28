import axios from "axios";
import { PLANS } from "./plans.js";

const MP_URL = "https://api.mercadopago.com/v1/payments";
const TOKEN = process.env.MP_ACCESS_TOKEN;

export async function createPixPayment(user, planKey) {
  const plan = PLANS[planKey];

  const payment = {
    transaction_amount: plan.price,
    description: `Plano Premium ${plan.label} – Bot de Lembretes`,
    payment_method_id: "pix",
    payer: {
      email: `${user}@mariomelembra.com.br`,
    },
  };

  const { data } = await axios.post(MP_URL, payment, {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
    },
  });

  return {
    id: data.id,
    qrCode: data.point_of_interaction.transaction_data.qr_code,
  };
}
