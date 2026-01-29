import { extrairTextoDaImagem } from "../services/vision.js";
import { analisarNotificacao } from "../services/ia.js";
import { salvarGasto } from "../services/firebase.js";
import { sendMessage, sendButtonList } from "../zapi.js";

export async function handleGastoPorNotificacao(payload) {
  try {
    // 1️⃣ OCR
    const textoOCR = await extrairTextoDaImagem(payload.imagem);

    // 2️⃣ IA (prompt específico)
    const respostaIA = await analisarNotificacao(textoOCR);

    // 3️⃣ PASSO 6 — decisão de fluxo
    if (respostaIA.erro) {
      await sendMessage(
        payload.phone,
        "Não consegui identificar nenhum valor nessa notificação 😕\nPode mandar outro print?",
      );
      return;
    }

    // 4️⃣ Vários gastos → escolha
    if (respostaIA.multiplos) {
      const buttons = respostaIA.gastos.map((g, i) => ({
        id: `escolher_gasto_${i}`,
        title: `${g.estabelecimento || "Desconhecido"} – R$ ${g.valor}`,
      }));

      await sendButtonList(
        payload.phone,
        "Encontrei mais de um gasto 👇\nQual você quer registrar?",
        buttons,
      );

      // aqui você guarda respostaIA.gastos em cache / session
      return;
    }

    // 5️⃣ Um gasto só → confirmação
    const gasto = respostaIA.gastos[0];

    await sendButtonList(
      payload.phone,
      `Encontrei um gasto de *R$ ${gasto.valor}* no *${gasto.estabelecimento || "local não identificado"}*.\nQuer registrar?`,
      [
        { id: "confirmar_gasto", title: "✅ Registrar" },
        { id: "cancelar_gasto", title: "❌ Cancelar" },
      ],
    );

    // aqui você guarda `gasto` em cache / session
  } catch (err) {
    console.error("Erro gasto por notificação:", err);
    await sendMessage(payload.phone, "Deu ruim aqui 😅 tenta de novo pra mim.");
  }
}
