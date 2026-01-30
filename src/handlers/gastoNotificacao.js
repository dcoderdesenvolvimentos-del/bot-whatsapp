// src/handlers/gastoNotificacao.js
import { extrairTextoDaImagem } from "../services/vision.js";
import { analisarNotificacao } from "../services/ia.js";
import { sendMessage, sendButtonList } from "../zapi.js";

function limparTextoNotificacao(texto) {
  return texto
    .split("\n")
    .map((l) => l.trim())
    .filter(
      (l) =>
        l &&
        !/SO CHAMA|TIM|VIVO|CLARO|4G|5G|LTE|WI.?FI|BATERIA|%/i.test(l) &&
        !/^\d{1,2}:\d{2}$/.test(l), // hora do celular
    )
    .join("\n");
}

globalThis.userSession ??= {};

export async function handleGastoPorNotificacao(payload) {
  try {
    const textoOCRRaw = await extrairTextoDaImagem(payload.imagem);
    const textoOCR = limparTextoNotificacao(textoOCRRaw);

    const respostaIA = await analisarNotificacao(textoOCR);

    if (respostaIA.erro) {
      await sendMessage(
        payload.phone,
        "Não consegui identificar nenhum valor nessa notificação 😕\nPode mandar outro print?",
      );
      return;
    }

    // 🔹 VÁRIOS GASTOS
    if (respostaIA.multiplos) {
      globalThis.userSession[payload.phone] = {
        tipo: "notificacao_multiplos",
        gastos: respostaIA.gastos,
      };

      const buttons = respostaIA.gastos.map((g, i) => ({
        id: `escolher_gasto_${i}`,
        title: `${g.estabelecimento || "Desconhecido"} – R$ ${g.valor}`,
      }));

      await sendButtonList(
        payload.phone,
        "Encontrei mais de um gasto 👇\nQual você quer registrar?",
        buttons,
      );
      return;
    }

    // 🔹 UM GASTO
    const gasto = respostaIA.gastos[0];

    globalThis.userSession[payload.phone] = {
      tipo: "notificacao_unico",
      gasto,
    };

    await sendButtonList(
      payload.phone,
      `📲 *Notificação bancária detectada*\n\n🏪 *Local:* ${gasto.estabelecimento}\n💰 *Valor:* R$ ${gasto.valor}\n⏱️ *Quando:* ${gasto.tempo_relativo || "agora"}\n\nDeseja registrar esse gasto?`,
      [
        { id: "confirmar_gasto", title: "✅ Registrar" },
        { id: "cancelar_gasto", title: "❌ Cancelar" },
      ],
    );
  } catch (err) {
    console.error("Erro gasto por notificação:", err);
    await sendMessage(payload.phone, "Deu ruim aqui 😅 tenta de novo pra mim.");
  }
}
