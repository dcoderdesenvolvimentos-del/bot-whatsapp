import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function analyzeIntent(text) {
  try {
    const agora = new Date();
    const dataHoraAtual = agora.toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const timestampAtual = Date.now();

    const prompt = `
Você é um classificador de intenções para um bot de WhatsApp
que possui DUAS funcionalidades:
1) LEMBRETES
2) LISTAS DE COMPRAS

============================
CONTEXTO
============================
HOJE É: ${dataHoraAtual} (horário de Brasília)
TIMESTAMP ATUAL: ${timestampAtual}

============================
REGRAS DE PRIORIDADE (MUITO IMPORTANTE)
============================

1️⃣ LISTAS DE COMPRAS (PRIORIDADE MÁXIMA)
- Se mencionar "lista de compras", "lista de mercado" ou "supermercado":
  → intencao = "criar_lista"
- Se mencionar "adicionar", "colocar", "incluir" itens em uma lista:
  → intencao = "adicionar_item_lista"
- Se mencionar "ver", "mostrar", "listar" uma lista:
  → intencao = "listar_itens_lista"
- LISTA DE COMPRAS NUNCA É LEMBRETE
- Mesmo que haja saudação ("oi", "olá"), IGNORE a saudação se houver pedido claro.

2️⃣ LEMBRETES
- Se mencionar "lembrar", "lembre", "aviso", horário ou data:
  → intencao = "criar_lembrete"
- Se mencionar "listar lembretes":
  → intencao = "listar_lembretes"
- Se mencionar "apagar", "excluir lembrete":
  → intencao = "excluir_lembrete"

3️⃣ OUTROS
- Saudação SEM pedido → "conversa_solta"
- Pedido de ajuda → "ajuda"
- Caso contrário → "desconhecido"

============================
REGRAS GERAIS
============================
- Retorne APENAS JSON válido
- Nunca escreva texto fora do JSON
- Não invente campos
- Use SOMENTE os formatos 

IMPORTANTE:
- Se o usuário disser "daqui X minutos" ou "daqui X horas":
  retorne:
  {
    "intencao": "criar_lembrete",
    "acao": "...",
    "offset_ms": X * 60 * 1000
  }
- NÃO retorne hora, minuto ou offset_dias nesses casos.

============================
FORMATOS DE RETORNO
============================

🔔 CRIAR LEMBRETE:
{
  "intencao": "criar_lembrete",
  "acao": "tomar água",
  "offset_dias": 1,
  "hora": 17,
  "minuto": 0
}

🛒 CRIAR LISTA:
{
  "intencao": "criar_lista",
  "lista": "supermercado"
}

🛒 ADICIONAR ITENS:
{
  "intencao": "adicionar_item_lista",
  "lista": "supermercado",
  "itens": ["arroz", "feijão"]
}

🛒 LISTAR ITENS:
{
  "intencao": "listar_itens_lista",
  "lista": "supermercado"
}

============================
MENSAGEM DO USUÁRIO
============================
"${text}"

JSON:
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
    });

    const respostaRaw = completion.choices[0].message.content;

    const respostaLimpa = respostaRaw
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();

    console.log("🧠 RESPOSTA IA LIMPA:", respostaLimpa);

    const data = JSON.parse(respostaLimpa);

    // 🔒 Fallback de segurança
    if (!data.intencao) {
      return { intencao: "desconhecido" };
    }

    return data;
  } catch (error) {
    console.error("❌ Erro na IA:", error);
    return { intencao: "desconhecido" };
  }
}
