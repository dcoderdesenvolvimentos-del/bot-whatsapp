// src/handlers/gastoNotificacao.js
import { extrairTextoDaImagem } from "../services/vision.js";
import { analisarNotificacao } from "../services/ia.js";
import { sendMessage, sendButtonList } from "../zapi.js";

globalThis.userSession ??= {};

export async function handleGastoPorNotificacao(payload) {
  try {
    const textoOCR = await extrairTextoDaImagem(payload.imagem);
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
      `Encontrei um gasto de *R$ ${gasto.valor}* no *${gasto.estabelecimento || "local não identificado"}*.\nQuer registrar?`,
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
