import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function analyzeIntent(text) {
  try {
    const agora = new Date();
    const agoraEmSP = new Date(
      agora.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })
    );

    const hoje = agoraEmSP.toLocaleDateString("pt-BR");
    const horaAtual = agoraEmSP.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const anoAtual = agoraEmSP.getFullYear();
    const mesAtual = agoraEmSP.getMonth();
    const diaAtual = agoraEmSP.getDate();

    const prompt = `
Você é um assistente que analisa mensagens e identifica a intenção do usuário.

INFORMAÇÕES ATUAIS (FUSO: America/Sao_Paulo / UTC-3):
- Data de hoje: ${hoje}
- Hora atual: ${horaAtual}
- Ano: ${anoAtual}
- Mês: ${mesAtual + 1}
- Dia: ${diaAtual}

⚠️ OBRIGATÓRIO: Todos os timestamps devem ser calculados considerando o fuso horário America/Sao_Paulo (UTC-3).

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
- hora: timestamp em milissegundos NO FUSO America/Sao_Paulo

CÁLCULO CORRETO DE TIMESTAMPS (America/Sao_Paulo):

Para "hoje às 18h":
\\\`javascript
// Cria data em São Paulo
const date = new Date();
date.setFullYear(${anoAtual});
date.setMonth(${mesAtual});
date.setDate(${diaAtual});
date.setHours(18);
date.setMinutes(0);
date.setSeconds(0);
date.setMilliseconds(0);

// Ajusta para UTC-3 (soma 3 horas no timestamp)
const timestamp = date.getTime() + (3 * 60 * 60 * 1000);
\\\`

Para "amanhã às 18h":
\\\`javascript
const date = new Date();
date.setFullYear(${anoAtual});
date.setMonth(${mesAtual});
date.setDate(${diaAtual + 1});
date.setHours(18);
date.setMinutes(0);
date.setSeconds(0);
date.setMilliseconds(0);
const timestamp = date.getTime() + (3 * 60 * 60 * 1000);
\\\
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
