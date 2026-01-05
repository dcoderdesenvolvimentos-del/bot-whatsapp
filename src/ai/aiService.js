import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function analyzeIntent(text) {
  try {
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

    const hojeTimestamp = new Date(
      anoAtual,
      mesAtual,
      diaAtual,
      18,
      0,
      0,
      0
    ).getTime();
    const amanhaTimestamp = new Date(
      anoAtual,
      mesAtual,
      diaAtual + 1,
      18,
      0,
      0,
      0
    ).getTime();

    const prompt = `Analise a mensagem e retorne JSON sem markdown.

CONTEXTO: Hoje ${hoje}, ${horaAtual}, timestamp ${Date.now()}

INTENÇÕES: criar_lembrete, listar_lembretes, excluir_lembrete, saudacao, ajuda, despedida

REGRA: "17, 18 e 19, segundo" = 18h

TIMESTAMPS:
- Hoje 18h: ${hojeTimestamp}
- Amanhã 18h: ${amanhaTimestamp}
- Daqui 10min: ${Date.now() + 600000}

EXEMPLOS:
"17, 18 e 19, segundo" → {"intencao":"criar_lembrete","acao":"lembrete","hora":${hojeTimestamp}}
"amanhã 15h ligar" → {"intencao":"criar_lembrete","acao":"ligar","hora":${amanhaTimestamp}}

Mensagem: "${text}"
JSON:`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
    });

    const resposta = completion.choices[0].message.content.trim();
    const json = resposta.replace(/json|/g, "").trim();

    return JSON.parse(json);
  } catch (error) {
    console.error("❌ Erro na IA:", error);
    return { intencao: "desconhecida" };
  }
}
