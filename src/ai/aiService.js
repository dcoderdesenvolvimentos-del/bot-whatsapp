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

1. Retorne APENAS UM JSON válido
2. Se o usuário pedir "lembrete + gasto de pagamento", use "criar_lembrete_pagamento"
3. NUNCA retorne dois JSONs separados
4. Se não souber, use "desconhecido"

3️⃣ OUTROS
- Saudação SEM pedido → "conversa_solta"
- Pedido de ajuda → "ajuda"
- Caso contrário → "desconhecido"

⚠️ REGRAS CRÍTICAS:
1. Retorne APENAS UM JSON válido
2. Se o usuário pedir "lembrete + gasto de pagamento", use "criar_lembrete_pagamento"
3. NUNCA retorne dois JSONs separados
4. Se não souber, use "desconhecido"

- AJUDA_GERAL: quando o usuário pergunta o que o bot pode fazer, como funciona, em que pode ajudar, o que voce pode fazer ou quais são suas funções.
EXMPLO:

Usuário: "quais são suas funções?"
Resposta:
{ "intencao": "AJUDA_GERAL" }

Usuário: "o que você pode fazer?"
Resposta:
{ "intencao": "AJUDA_GERAL" }


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



- Se for consulta de gastos por período, retorne:
  {
    "intencao": "consultar_gasto_periodo",
    "data_inicio": "DD-MM-AAAA",
    "data_fim": "DD-MM-AAAA"
  }
  
  IMPORTANTE SOBRE DATAS:
  - ANO ATUAL: 2026
  - FORMATO OBRIGATÓRIO: DD-MM-AAAA (exemplo: 13-01-2026)
  - Se o usuário NÃO especificar o ano, considere 2026
  - Exemplos:
    * "gastos de outubro" → 01-10-2026 até 31-10-2026
    * "gastos de agosto" → 01-08-2026 até 31-08-2026
    * "gastos de janeiro de 2025" → 01-01-2025 até 31-01-2025



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

Considere linguagem informal, abreviações e gírias do português brasileiro.

Equivalências comuns:
- "hj" = hoje
- "pfv" = por favor
- "pra" = para
- "qto" = quanto
- "me manda", "me envia", "me mostra" = listar / consultar
- palavras extras como "meu chegado", "mano", "amigo" devem ser ignoradas

Quando o usuário pedir resumo ou total de gastos do dia atual, mesmo de forma indireta,
use a intenção correta.

Exemplos válidos que DEVEM ser entendidos como consultar gastos de hoje:

"me envia um resumo dos meus gastos de hj pfv"
"me manda quanto gastei hj"
"resumo de gastos hoje"
"quanto foi que eu gastei hoje mano"
"me mostra meus gastos de hoje aí"

Todos devem gerar:
{
  intencao: "consultar_gasto_periodo",
  data_inicio: DATA_DE_HOJE,
  data_fim: DATA_DE_HOJE
}

Se o usuário mencionar compra parcelada, cartão de crédito, parcelas ou "X vezes",
retorne:

{
  "intencao": "criar_gasto_parcelado",
  "valor_total": número,
  "parcelas": número,
  "descricao": descrição curta do gasto,
  "categoria": categoria adequada
}



============================
REGRAS GERAIS
============================
- Retorne APENAS JSON válido
- Nunca escreva texto fora do JSON
- Não invente campos
- Use SOMENTE os formatos 

IMPORTANTE:
Se o usuário mencionar MAIS DE UMA ação, tarefa ou compromisso
no mesmo texto ou áudio, você DEVE:

1. Separar cada lembrete individualmente
2. Retornar todos dentro de um array chamado "lembretes"
3. Nunca juntar ações diferentes em um único lembrete

Exemplo:

Entrada:
"me lembra amanhã às 9h de pagar a internet e às 14h de buscar o menino"

Saída:
{
  "intencao": "criar_lembrete",
  "lembretes": [
    { "acao": "pagar a internet", "offset_dias": 1, "hora": 9, "minuto": 0 },
    { "acao": "buscar o menino", "offset_dias": 1, "hora": 14, "minuto": 0 }
  ]
}

- Se for cadastrar lembrete RECORRENTE, retorne:
  {
    "intencao": "criar_lembrete_recorrente",
    "mensagem": "texto do lembrete",
    "tipo_recorrencia": "diario|semanal|mensal|anual",
    "valor_recorrencia": "número ou dia da semana",
    "horario": "HH:MM" // se não especificar, retorne "00:00"
  }
  
  Exemplos de recorrência:
  - "todo dia 10" → tipo: "mensal", valor: "10"
  - "toda segunda-feira" → tipo: "semanal", valor: "segunda"
  - "todo dia 3 de janeiro" → tipo: "anual", valor: "03-01"
  - "todos os dias às 10h" → tipo: "diario", valor: null


Se o usuário pedir para VER ou LISTAR lembretes,
identifique também filtros de tempo:

- "hoje" → periodo = "hoje"
- "amanhã" → periodo = "amanha"
- "depois de amanhã" → periodo = "depois_amanha"
- "dia X" → dia = X
- "segunda", "terça", "quarta", "quinta", "sexta", "sábado", "domingo"
  → dia_semana = "<dia>"



IMPORTANTE:
- Se o usuário disser "daqui X minutos" ou "daqui X horas":
  retorne:
  {
    "intencao": "criar_lembrete",
    "acao": "...",
    "offset_ms": X * 60 * 1000
  }
- NÃO retorne hora, minuto ou offset_dias nesses casos.

IMPORTANTE:
- Se o usuário mencionar "dia X" (número do mês), use o campo "dia".
- NUNCA converta "dia X" em offset_dias.
- offset_dias só pode ser usado quando o usuário falar:
  "daqui X dias", "em X dias", "depois de X dias".

  REGRA OBRIGATÓRIA:

Sempre retorne o campo "intencao".

Se houver uma ação que represente um lembrete,
use obrigatoriamente:

"intencao": "criar_lembrete"

Mesmo que o usuário informe apenas a data,
ou apenas a ação,
ou apenas o horário,
a intenção NUNCA pode ser omitida.

  Exemplo:
  Entrada: "me lembra dia 12 de pagar a internet"
Saída correta:
{
  "intencao": "criar_lembrete",
  "acao": "pagar a internet",
  "dia": 12
}
  

ATENÇÃO MÁXIMA:

Sempre extraia HORA e MINUTO quando o usuário mencionar:
- "às 11 horas"
- "11h"
- "11 da manhã"
- "11 da noite"
- "meio-dia"
- "meia-noite"

Exemplos obrigatórios:

Entrada:
"me lembra dia 12 às 11 horas da manhã"

Saída correta:
{
  acao: "pagar a internet",
  dia: 12,
  hora: 11,
  minuto: 0
}

NUNCA ignore horário explícito mencionado pelo usuário.



============================
FORMATOS DE RETORNO
============================

AJUDA GERAL
{
  "intencao": "AJUDA_GERAL"
}


🔔 CRIAR LEMBRETE:
{
  "intencao": "criar_lembrete",
  "acao": "tomar água",
  "offset_dias": 1,
  "hora": 17,
  "minuto": 0
}

criar_lembrete_pagamento - Quando o usuário pede para lembrar de PAGAR algo E menciona o VALOR
{
  "intencao": "criar_lembrete_pagamento",
  "acao": "descrição do pagamento",
  "valor": 1200,
  "local": "onde foi o gasto",
  "categoria": "alimentacao|transporte|saude|lazer|moradia|educacao|outros",
  "offset_dias": 1,
  "horario": "09:00"
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
