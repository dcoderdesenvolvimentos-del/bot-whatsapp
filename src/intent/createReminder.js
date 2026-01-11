import { addReminder } from "../services/reminderService.js";
import { createTimestampBR } from "../utils/dateUtils.js";

// 🔧 helper para data/hora no fuso do Brasil
function nowInSaoPaulo() {
  return new Date(
    new Date().toLocaleString("en-US", {
      timeZone: "America/Sao_Paulo",
    })
  );
}

export async function createReminder(userDocId, data) {
  console.log("🔥 CHEGOU NO CREATE REMINDER");
  console.log("🔥 USER DOC ID:", userDocId);
  console.log("🔥 DATA COMPLETO:", data);

  // =========================
  // 🔁 CASO MÚLTIPLO
  // =========================
  if (Array.isArray(data.lembretes)) {
    const resumos = [];

    for (const lembrete of data.lembretes) {
      // hora 24 → 00 do dia seguinte
      if (lembrete.hora === 24) {
        lembrete.hora = 0;
        lembrete.offset_dias = (lembrete.offset_dias || 0) + 1;
      }

      // offset em minutos
      if (typeof lembrete.offset_ms === "number") {
        lembrete.when = Date.now() + lembrete.offset_ms;
      }

      // offset em dias + hora (BR)
      if (
        typeof lembrete.offset_dias === "number" &&
        typeof lembrete.hora === "number" &&
        typeof lembrete.minuto === "number"
      ) {
        const base = nowInSaoPaulo();

        base.setHours(0, 0, 0, 0);
        base.setDate(base.getDate() + lembrete.offset_dias);
        base.setHours(lembrete.hora, lembrete.minuto, 0, 0);

        lembrete.when = base.getTime();
      }

      await createReminder(userDocId, lembrete);

      resumos.push({
        acao: lembrete.acao,
        when: lembrete.when,
      });
    }

    let resposta = `✅ Prontinho! Criei ${resumos.length} lembretes:\n\n`;

    resumos.forEach((r, i) => {
      const d = new Date(r.when).toLocaleString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });

      resposta += `${i + 1}️⃣ ${d} — ${r.acao}\n`;
    });

    return resposta;
  }

  const phone = userDocId;

  if (!phone) {
    console.error("❌ PHONE UNDEFINED!");
    return "❌ Erro ao identificar usuário.";
  }

  // 🛡️ PROTEÇÃO CONTRA ERRO DA IA
  if (typeof data.dia === "number") {
    // Se for dia do mês, ignora qualquer offset
    data.offset_dias = null;
  }
  // 🛡️ FALLBACK SIMPLES DE HORA (se IA falhar)
  if (
    typeof data.dia === "number" &&
    typeof data.hora !== "number" &&
    typeof data.texto_original === "string"
  ) {
    const match = data.texto_original.match(/às?\s*(\d{1,2})/);

    if (match) {
      data.hora = Number(match[1]);
      data.minuto = 0;
    }
  }

  /**
   * =====================================================
   * ⏱️ CASO 1 — OFFSET RELATIVO (daqui X minutos / horas)
   * =====================================================
   * 👉 PRIORIDADE MÁXIMA
   * Se existir offset_ms, ignora TODO o resto
   */
  if (typeof data.offset_ms === "number" && data.offset_ms > 0) {
    const when = Date.now() + data.offset_ms;

    await addReminder(phone, {
      text: data.acao,
      when,
    });

    const dateObj = new Date(when);

    return (
      `✅ *Lembrete criado!*\n\n` +
      `📌 ${data.acao}\n` +
      `🕐 ${dateObj.toLocaleString("pt-BR", {
        timeZone: "America/Sao_Paulo",
      })}`
    );
  }

  /**
   * =====================================================
   * 🧩 CASO 2 — REGRA ANTIGA "DAQUI X MINUTOS"
   * =====================================================
   * 👉 Mantida por compatibilidade
   * 👉 Só entra se NÃO houver offset_ms
   */
  if (
    data.offset_dias === 0 &&
    data.hora === 0 &&
    typeof data.minuto === "number" &&
    data.minuto > 0
  ) {
    const when = Date.now() + data.minuto * 60 * 1000;

    await addReminder(phone, {
      text: data.acao,
      when,
    });

    const dateObj = new Date(when);

    return (
      `✅ *Lembrete criado!*\n\n` +
      `📌 ${data.acao}\n` +
      `🕐 ${dateObj.toLocaleString("pt-BR", {
        timeZone: "America/Sao_Paulo",
      })}`
    );
  }

  /**
   * =====================================================
   * 🕒 CASO 3 — HORÁRIO ABSOLUTO (com dia do mês)
   * =====================================================
   */

  // 🔹 AGORA = referência
  const now = new Date();

  // 🔹 Normaliza offset (padrão: hoje)
  let offsetDiasFinal =
    typeof data.offset_dias === "number" ? data.offset_dias : 0;

  // 🔒 Normaliza hora/minuto (regra que você já aprovou)
  let hora = typeof data.hora === "number" ? data.hora : null;

  let minuto = typeof data.minuto === "number" ? data.minuto : null;

  // ❌ Se não veio nenhuma informação de tempo
  if (
    hora === null &&
    minuto === null &&
    typeof data.dia !== "number" &&
    typeof offsetDiasFinal !== "number"
  ) {
    return "❌ Não consegui entender quando devo te lembrar.";
  }

  /**
   * ============================================
   * 🧠 AJUSTE DE DATA ABSOLUTA (DIA DO MÊS)
   * ============================================
   * Exemplo: "dia 12"
   */
  if (typeof data.dia === "number") {
    // 🎯 Cria data alvo no mês atual
    const alvo = new Date(now.getFullYear(), now.getMonth(), data.dia, 0, 1, 0);

    // ⏩ Se o dia já passou, joga pro mês seguinte
    if (alvo < now) {
      alvo.setMonth(alvo.getMonth() + 1);
    }

    // 🔁 Converte para offset_dias
    offsetDiasFinal = Math.ceil((alvo - now) / (1000 * 60 * 60 * 24));
  }

  // 🧠 Só data → 00:01
  if (hora === null && minuto === null) {
    hora = 0;
    minuto = 1;
  }

  // 🧠 Só hora → hoje
  if (hora !== null && minuto === null) {
    minuto = 0;
  }

  // 🕒 AGORA SIM: cria timestamp
  const when = createTimestampBR({
    offset_dias: offsetDiasFinal,
    hora,
    minuto,
  });

  // ⛔ Bloqueia passado
  if (when < Date.now()) {
    return "❌ Esse horário já passou! Tente um horário futuro.";
  }

  // 💾 Salva
  await addReminder(phone, {
    text: data.acao,
    when,
  });

  // 👉 MÚLTIPLOS
  if (Array.isArray(data.lembretes)) {
    let mensagens = [];

    for (const lembrete of data.lembretes) {
      const resposta = await createReminder(userDocId, lembrete);
      mensagens.push(resposta);
    }

    return `✅ Criei ${mensagens.length} lembretes com sucesso!`;
  }

  // 🔹 CASO ÚNICO (fluxo antigo)
  // aqui entra TODO o código que você já tinha

  // 👉 ÚNICO (SEU CÓDIGO ATUAL CONTINUA)
  // offset_ms, hora absoluta, etc...

  // 🔍 DEBUG FINAL (agora confiável)
  const dateObj = new Date(when);
  console.log("🔍 TIMESTAMP FINAL:", when);
  console.log("🔍 ISO STRING:", dateObj.toISOString());
  console.log(
    "🔍 TIMEZONE SERVIDOR:",
    Intl.DateTimeFormat().resolvedOptions().timeZone
  );
  console.log("🔍 LOCAL BR:", dateObj.toLocaleString("pt-BR"));

  // 📅 FORMATAÇÃO FINAL
  const dataFormatada = dateObj.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });

  return {
    mensagem:
      `✅ *Lembrete criado!*\n\n` +
      `📌 ${data.acao}\n` +
      `🕐 ${dateObj.toLocaleString("pt-BR")}`,
    resumo: {
      acao: data.acao,
      when,
    },
  };
}
