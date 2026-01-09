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


Quando o usuário relatar um gasto, identifique:

- intencao: "criar_gasto"
- valor: número (ex: 50, 120.90)
- local: onde o gasto aconteceu
- categoria: uma palavra simples e genérica

Categorias possíveis:
alimentação, supermercado, transporte, saúde, lazer, contas, educação, outros

Exemplos:
"gastei 50 reais na padaria" →
{ intencao: criar_gasto, valor: 50, local: "padaria", categoria: "alimentação" }

"paguei 120 de luz" →
{ intencao: criar_gasto, valor: 120, local: "luz", categoria: "contas" }

"coloquei gasolina" →
{ intencao: criar_gasto, valor: 100, local: "posto", categoria: "transporte" }

Se não tiver certeza da categoria, use "outros".



Quando o usuário perguntar sobre gastos em um período de tempo:

Identifique:
- intencao: "consultar_gasto_periodo"
- data_inicio: data no formato YYYY-MM-DD
- data_fim: data no formato YYYY-MM-DD

Regras:
- "ontem" → data_inicio = data_fim = ontem
- "anteontem" → data_inicio = data_fim = anteontem
- "essa semana" → domingo até hoje
- "semana passada" → domingo a sábado da semana anterior
- "esse mês" → dia 1 até hoje
- "mês passado" → dia 1 ao último dia do mês anterior
- "do dia X até o dia Y" → intervalo explícito
- Se o ano não for citado, use o ano atual

Exemplos:
"quanto gastei ontem" →
{ intencao: consultar_gasto_periodo, data_inicio: 2026-01-07, data_fim: 2026-01-07 }

"quanto gastei na semana passada" →
{ intencao: consultar_gasto_periodo, data_inicio: 2025-12-29, data_fim: 2026-01-04 }

"quanto gastei do dia 5 até o dia 10" →
{ intencao: consultar_gasto_periodo, data_inicio: 2026-01-05, data_fim: 2026-01-10 }


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
  intent: "criar_lista_compras",
  data: {
    nomeLista: "supermercado",
    itens: ["arroz", "açúcar", "óleo"]
  }
}


🛒 ADICIONAR ITENS:
{
  "intencao": "adicionar_item_lista",
  "data": {
    "nomeLista": "supermercado",
    "itens": ["arroz", "feijão"]
  }
}

{
  "intencao": "remover_item_lista",
  "data": {
    "nomeLista": "supermercado",
    "itens": ["arroz"]
  }
}


{
  "intencao": "excluir_lista",
  "data": {
    "nomeLista": "materiais escolares"
  }
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
