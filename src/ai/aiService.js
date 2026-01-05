import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function analyzeIntent(text) {
  try {
    const prompt = `
Você é um assistente que analisa mensagens e identifica a intenção do usuário.

Retorne APENAS um JSON válido, sem markdown, sem explicações.

Intenções possíveis:
- criar_lembrete
- listar_lembretes
- excluir_lembrete
- saudacao
- ajuda
- despedida

Para "criar_lembrete", extraia:
- acao: o que fazer
- hora: timestamp em milissegundos (use Date.now() como base)

Para "excluir_lembrete", extraia:
- indice: número do lembrete (ex: 1, 2, 3...)

Exemplos:

Entrada: "me lembra de tomar água daqui 2 minutos"
Saída: {"intencao":"criar_lembrete","acao":"tomar água","hora":${
      Date.now() + 2 * 60 * 1000
    }}

Entrada: "lista meus lembretes"
Saída: {"intencao":"listar_lembretes"}

Entrada: "apaga o lembrete 1"
Saída: {"intencao":"excluir_lembrete","indice":1}

Entrada: "oi"
Saída: {"intencao":"saudacao"}

Entrada: "tchau"
Saída: {"intencao":"despedida"}

Agora analise:
"${text}"
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Você retorna APENAS JSON válido, sem markdown, sem explicações.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.3,
    });

    const response = completion.choices[0].message.content.trim();

    // Remove markdown se vier
    const cleanResponse = response.replace(/json\n?/g, "").replace(/\n?/g, "");

    const parsed = JSON.parse(cleanResponse);

    console.log("🧠 IA RETORNOU:", parsed);

    return parsed;
  } catch (error) {
    console.error("❌ Erro na IA:", error);
    return { intencao: "erro" };
  }
}
