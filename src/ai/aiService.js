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

    const prompt = `
Você é um assistente que analisa mensagens e identifica a intenção do usuário.

*CONTEXTO ATUAL (São Paulo - America/Sao_Paulo):*
- Data: ${hoje}
- Hora: ${horaAtual}
- Ano: ${anoAtual}
- Mês: ${mesAtual + 1}
- Dia: ${diaAtual}
- Timestamp atual: ${Date.now()}

Retorne APENAS um JSON válido, sem markdown.

*Intenções:*
- criar_lembrete
- listar_lembretes
- excluir_lembrete
- saudacao
- ajuda
- despedida

*REGRAS IMPORTANTES:*

1. Quando o usuário mencionar múltiplos horários e especificar qual quer (ex: "primeiro", "segundo", "terceiro"), conte a partir do PRIMEIRO horário mencionado:
   - "horários 17, 18 e 19, quero o segundo" → segundo = 18h ✅
   - "às 10, 11 e 12, me lembra no primeiro" → primeiro = 10h ✅

2. SEMPRE identifique corretamente a posição ordinal (primeiro=1º, segundo=2º, terceiro=3º)

*CÁLCULO DE TIMESTAMPS:*

"hoje às HH:MM" → Date.UTC(${anoAtual}, ${mesAtual}, ${diaAtual}, HH+3, MM, 0, 0)
"amanhã às HH:MM" → Date.UTC(${anoAtual}, ${mesAtual}, ${diaAtual}, HH+3, MM, 0, 0)
"daqui X minutos" → ${Date.now()} + (X * 60000)

*Exemplos:*

"me lembra de tomar água às 17, 18 e 19, quero o segundo horário"
→ {"intencao":"criar_lembrete","acao":"tomar água","hora":${Date.UTC(
      anoAtual,
      mesAtual,
      diaAtual,
      21,
      0,
      0,
      0
    )}}

Mensagem do usuário: "${text}"

Retorne APENAS o JSON:`;

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
