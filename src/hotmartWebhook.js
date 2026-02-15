import { db } from "./firebase.js";
import { sendMessage } from "./zapi.js";

function calcularExpiracao(dias) {
  const agora = new Date();
  agora.setDate(agora.getDate() + dias);
  return agora;
}

function obterPlano(productId) {
  switch (productId) {
    case "ID_MENSAL":
      return { nome: "mensal", dias: 30 };

    case "ID_TRIMESTRAL":
      return { nome: "trimestral", dias: 90 };

    case "ID_SEMESTRAL":
      return { nome: "semestral", dias: 180 };

    case "ID_ANUAL":
      return { nome: "anual", dias: 365 };

    default:
      return null;
  }
}

export async function handleHotmartWebhook(payload, headers) {
  const tipo = payload.event;
  const email = payload.data?.buyer?.email;
  const productId = payload.data?.product?.id;

  if (!email) return;

  const planoInfo = obterPlano(productId);
  if (!planoInfo) return;

  const snap = await db
    .collection("users")
    .where("email", "==", email)
    .limit(1)
    .get();

  if (snap.empty) return;

  const userId = snap.docs[0].id;

  // ✅ Compra aprovada
  if (tipo === "PURCHASE_APPROVED") {
    const expiracao = calcularExpiracao(planoInfo.dias);

    await db.collection("users").doc(userId).update({
      plano: planoInfo.nome,
      premium: true,
      statusPagamento: "ativo",
      expiresAt: expiracao,
      updatedAt: new Date(),
    });

    console.log("✅ Plano ativado:", planoInfo.nome, email);
  }

  await sendMessage(
    snap.docs[0].data().phone,
    `🔥 Seu plano ${planoInfo.nome.toUpperCase()} foi ativado com sucesso!\n\n` +
      `📅 Válido até: ${expiracao.toLocaleDateString("pt-BR")}\n\n` +
      `Obrigado por apoiar o Mário 🚀`,
  );

  // ❌ Cancelamento
  if (
    tipo === "PURCHASE_CANCELED" ||
    tipo === "PURCHASE_REFUNDED" ||
    tipo === "SUBSCRIPTION_CANCELED"
  ) {
    await db.collection("users").doc(userId).update({
      premium: false,
      statusPagamento: "cancelado",
      updatedAt: new Date(),
    });

    console.log("❌ Plano cancelado:", email);
  }
}
