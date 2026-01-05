import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function analyzeIntent(text) {
  try {
    // Pega hora atual em São Paulo
    const agoraUTC = new Date();
    const agoraSP = new Date(
      agoraUTC.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })
    );

    const hoje = agoraSP.toLocaleDateString("pt-BR");
    const horaAtual = agoraSP.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const anoAtual = agoraSP.getFullYear();
    const mesAtual = agoraSP.getMonth();
    const diaAtual = agoraSP.getDate();
    const horaAtualNum = agoraSP.getHours();
    const minutoAtualNum = agoraSP.getMinutes();

    const prompt = `
Você é um assistente que analisa mensagens e identifica a intenção do usuário.

CONTEXTO ATUAL (São Paulo - America/Sao_Paulo):
- Data: ${hoje}
- Hora: ${horaAtual}
- Ano: ${anoAtual}
- Mês: ${mesAtual + 1}
- Dia: ${diaAtual}
- Timestamp atual: ${Date.now()}

Retorne APENAS um JSON válido, sem markdown.

Intenções:
- criar_lembrete
- listar_lembretes
- excluir_lembrete
- saudacao
- ajuda
- despedida

Para criar_lembrete:
- acao: texto da ação
- hora: timestamp em milissegundos

REGRAS DE CÁLCULO:

1. "daqui X minutos" → ${Date.now()} + (X * 60000)

2. "daqui X horas" → ${Date.now()} + (X * 3600000)

3. "hoje às HH:MM" → Use Date.UTC(${anoAtual}, ${mesAtual}, ${diaAtual}, HH+3, MM, 0, 0)
   - IMPORTANTE: Some 3 horas na hora solicitada para compensar UTC-3
   - Exemplo: "hoje às 18h" → Date.UTC(${anoAtual}, ${mesAtual}, ${diaAtual}, 21, 0, 0, 0)

4. "amanhã às HH:MM" → Date.UTC(${anoAtual}, ${mesAtual}, ${
      diaAtual + 1
    }, HH+3, MM, 0, 0)

Exemplos:

"me lembra de tomar água amanhã às 18h"
→ {"intencao":"criar_lembrete","acao":"tomar água","hora":${Date.UTC(
      anoAtual,
      mesAtual,
      diaAtual + 1,
      21,
      0,
      0,
      0
    )}}

"me lembra de ligar pro João hoje às 15h"
→ {"intencao":"criar_lembrete","acao":"ligar pro João","hora":${Date.UTC(
      anoAtual,
      mesAtual,
      diaAtual,
      18,
      0,
      0,
      0
    )}}

Mensagem do usuário: "${text}"

Retorne APENAS o JSON:`;

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
