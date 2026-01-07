import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function analyzeIntent(text) {
  try {
    const agora = new Date();
    const hoje = agora.toLocaleDateString("pt-BR");
    const horaAtual = agora.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const prompt = `
Você é um classificador de intenções para um bot de lembretes.

REGRAS:
- Se mencionar "lembr", "criar", "adicionar", "aviso" → criar_lembrete
- Se mencionar "list", "ver", "mostrar lembretes" → listar_lembretes  
- Se mencionar "apagar", "deletar", "excluir" → excluir_lembrete
- Se for saudação tipo "oi", "olá", "bom dia" → conversa_solta
- Se pedir piada → piada
- Se pedir ajuda → ajuda
- Caso contrário → desconhecido

Analise a mensagem e retorne APENAS JSON válido.

NUNCA retorne datas completas, timestamps ou strings ISO.

Retorne somente:
- intencao
- acao
- offset_dias (0=hoje, 1=amanhã, 2=depois de amanhã)
- hora (número 0–23)
- minuto (número 0–59)

REGRAS:
- Se o usuário mencionar vários horários e disser "primeiro", "segundo" ou "terceiro",
  escolha o horário correspondente.
- Exemplo: "17, 18 e 19, segundo" → hora = 18
- Se não houver minuto explícito, use 0.

Exemplo:
"amanhã às 17 horas" →
{
  "intencao": "criar_lembrete",
  "acao": "tomar água",
  "offset_dias": 1,
  "hora": 17,
  "minuto": 0
}

Mensagem: "${text}"
JSON:
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
    });

    const respostaRaw = completion.choices[0].message.content;

    // remove ```json, ``` e espaços extras
    const respostaLimpa = respostaRaw
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();

    console.log("🧠 RESPOSTA IA LIMPA:", respostaLimpa);

    return JSON.parse(respostaLimpa);
  } catch (error) {
    console.error("❌ Erro na IA:", error);
    return { intencao: "desconhecida" };
  }
}
