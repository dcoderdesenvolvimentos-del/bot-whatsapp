const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function analyzeMessage(message, userContext = {}) {
  try {
    const systemPrompt = `Você é um assistente que analisa mensagens de usuários e identifica intenções.

Retorne SEMPRE um JSON válido com:
{
  "action": "criar_lembrete" | "listar_lembretes" | "deletar_lembrete" | "cancelar_plano" | "conversa_geral",
  "data": {
    "message": "texto do lembrete",
    "datetime": "2025-12-30T10:00:00",
    "reminder_id": "id se for deletar"
  }
}

Exemplos:
- "me lembra de comprar pão amanhã às 10h" → criar_lembrete
- "quais meus lembretes?" → listar_lembretes
- "apaga o lembrete 3" → deletar_lembrete
- "cancela meu plano" → cancelar_plano

Data/hora atual: ${new Date().toISOString()}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message },
      ],
      temperature: 0.3,
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(completion.choices[0].message.content);
    return result;
  } catch (error) {
    console.error("❌ Erro no AI Service:", error);
    return {
      action: "conversa_geral",
      data: {},
    };
  }
}

module.exports = { analyzeMessage };
