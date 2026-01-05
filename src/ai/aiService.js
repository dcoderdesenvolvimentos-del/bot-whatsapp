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
Você é um assistente que analisa mensagens e identifica a intenção do usuário.

*Data e hora atual:*
- Hoje: ${hoje}
- Hora atual: ${horaAtual}
- Timestamp atual: ${Date.now()}

Retorne APENAS um JSON válido, sem markdown, sem explicações.

*Intenções possíveis:*
- criar_lembrete
- listar_lembretes
- excluir_lembrete
- saudacao
- ajuda
- despedida

*Para "criar_lembrete", extraia:*
- acao: o que fazer (ex: "tomar água")
- hora: timestamp em milissegundos

*Regras de cálculo de tempo:*
- "daqui X minutos" → Date.now() + (X * 60 * 1000)
- "daqui X horas" → Date.now() + (X * 60 * 60 * 1000)
- "amanhã às 17h" → próximo dia + 17:00
- "depois de amanhã às 17h" → daqui 2 dias + 17:00
- "segunda às 10h" → próxima segunda-feira + 10:00

*Exemplos:*

Entrada: "me lembra de tomar água daqui 2 minutos"
Saída: {"intencao":"criar_lembrete","acao":"tomar água","hora":${
      Date.now() + 2 * 60 * 1000
    }}

Entrada: "me lembra de ligar pro João amanhã às 15h"
Saída: {"intencao":"criar_lembrete","acao":"ligar pro João","hora":${new Date(
      agora.getTime() + 24 * 60 * 60 * 1000
    ).setHours(15, 0, 0, 0)}}

Entrada: "me lembra de ir na academia depois de amanhã às 17h"
Saída: {"intencao":"criar_lembrete","acao":"ir na academia","hora":${new Date(
      agora.getTime() + 48 * 60 * 60 * 1000
    ).setHours(17, 0, 0, 0)}}

Entrada: "lista meus lembretes"
Saída: {"intencao":"listar_lembretes"}

Entrada: "apaga o lembrete 1"
Saída: {"intencao":"excluir_lembrete","indice":1}

Agora analise:
"${text}"
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Você retorna APENAS JSON válido, sem markdown, sem explicações. Calcule timestamps corretamente com base na data/hora atual fornecida.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.3,
    });

    const response = completion.choices[0].message.content.trim();
    const cleanResponse = response.replace(/json\n?/g, "").replace(/\n?/g, "");

    const parsed = JSON.parse(cleanResponse);

    console.log("🧠 IA RETORNOU:", parsed);

    return parsed;
  } catch (error) {
    console.error("❌ Erro na IA:", error);
    return { intencao: "erro" };
  }
}
