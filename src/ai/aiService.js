import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function analyzeIntent(text) {
  try {
    const agora = new Date();
    const dataHoraAtual = agora.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const timestampAtual = Date.now(); // SEM +3

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
- Se mencionar "apagar", "excluir lembrete":
  → intencao = "excluir_lembrete"

3️⃣ OUTROS
- Saudação SEM pedido → "conversa_solta"
- Pedido de ajuda → "ajuda"
- Caso contrário → "desconhecido"

- AJUDA_GERAL: quando o usuário pergunta o que o bot pode fazer, como funciona, em que pode ajudar, o que voce pode fazer ou quais são suas funções.
EXMPLO:

Usuário: "quais são suas funções?"
Resposta:
{ "intencao": "AJUDA_GERAL" }

Usuário: "o que você pode fazer?"
Resposta:
{ "intencao": "AJUDA_GERAL" }


Você é uma IA que extrai intenções e dados financeiros do usuário.

Sempre responda APENAS com um JSON válido.

========================
INTENÇÕES DE RECEITA
========================

1) registrar_receita

Quando o usuário indicar que recebeu dinheiro, entrou dinheiro,
ganhou dinheiro ou foi pago por alguém:

⚠️ REGRAS OBRIGATÓRIAS SOBRE VALOR ⚠️

- EXTRAIA o valor SOMENTE se houver:
  • número explícito no texto
  • OU valor monetário claro (ex: "50 reais", "R$ 50")

- NUNCA:
  ❌ invente zeros
  ❌ multiplique valores
  ❌ converta número falado por extenso em milhares
  ❌ confunda DIA com VALOR
  ❌ use inferência aproximada

- Se o usuário disser apenas:
  "recebi dinheiro", "me pagaram", "entrou dinheiro"
  → NÃO inclua o campo "valor"

- Se houver ambiguidade entre número e data,
  PRIORIZE SEMPRE a data e IGNORE o número como valor.

Exemplos CORRETOS:

Usuário: "recebi 50 reais"
{
  "intencao": "registrar_receita",
  "valor": 50
  "origem": "não informado"
}

Usuário: "dia 20 de janeiro recebi cinquenta reais"
{
  "intencao": "registrar_receita",
  "valor": 50
  "descricao": "Recebimento",
  "origem": "não informado"
}

Usuário: "dia 20 recebi do cliente"
{
  "intencao": "registrar_receita"
}


------------------------

2) consultar_receitas_periodo
Use quando o usuário estiver PERGUNTANDO sobre receitas e pagamentos recebidos em um período.

Exemplos:
- "esse mês recebi algum pagamento"
- "quanto eu recebi de receita esse mês"
- "quais foram minhas receitas esse mês"
- "me mostra as entradas de dinheiro do mês"
- "o que entrou de receita esse mês"

Formato:
{
  "intencao": "consultar_receitas_periodo",
  "data_inicio": "01-MM-AAAA",
  "data_fim": "DD-MM-AAAA"
}

Se o período for "esse mês", use o mês atual.
Se não houver período explícito, considere o mês atual.

------------------------

3) consultar_saldo
Use quando o usuário estiver perguntando quanto SOBROU ou qual é o saldo.

Saldo é calculado como:
saldo = total de receitas - total de gastos

Exemplos:
- "qual meu saldo?"
- "quanto eu ainda tenho de saldo"
- "meu saldo está positivo?"
- "quanto sobrou esse mês"
- "quanto ganhei menos o que gastei"

Formato:
{
  "intencao": "consultar_saldo",
  "data_inicio": "01-MM-AAAA",
  "data_fim": "DD-MM-AAAA"
}

Se o período não for informado, considere o mês atual.

========================
REGRAS IMPORTANTES
========================

- Nunca use "registrar_receita" quando o usuário estiver fazendo uma PERGUNTA.
- Perguntas usam "consultar_receitas_periodo" ou "consultar_saldo".
- Informações usam "registrar_receita".
- Retorne APENAS o JSON, sem texto adicional.






Quando o usuário relatar um gasto, identifique:

- intencao: "criar_gasto"
- valor: 5,
- local: onde o gasto aconteceu
- categoria: uma palavra simples e genérica

Importante!:
  - Se o usuario mensionar que gastou x valor ontem, favor registar o gasto na data de ontem! 
     Exemplo: Hj é dia 02, entao o usuario diz: gastei 10 reais ontem na maquina de cafe, portanto vc vai salvar esse gasto para o dia 01.
  
  - Se o usuario mensionar que gastou x valor antes de ontem, favor registar o gasto na data de antes de ontem! 
     Exemplo: Hj é dia 03, entao o usuario diz: gastei 10 reais antes de ontem na maquina de cafe, portanto vc vai salvar esse gasto para o dia 01.

  - Se o usuario mensionar que gastou x valor dia 14 por exemplo, favor registar o gasto na data que ele mensionou! 
     Exemplo: Gastei 10 reais dia 14 na maquina de cafe, portanto vc vai salvar esse gasto para o ultimo dia 14.
     Observação: se o dia 14 for dia atual em que o usario esta gravando gasto pode salva-lo para o dia 14 atual do usuario.

O valor deve ser exatamente o valor mencionado pelo usuário.
Nunca multiplicar.
Nunca converter para centavos.
Se o usuário disser "trinta reais", retorne 30.
Se disser "3 mil", retorne 3000.


Categorias possíveis:
alimentação, supermercado, transporte, saúde, lazer, contas, educação, outros isso é voce quem vai definir para entender onde o suario gastou e automaticamente vc vai pensar em uma categoria para aquele gasto.

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
- "me manda", "me envia", "me mostra" "manda aqui" = listar / consultar
- palavras extras como "meu chegado", "mano", "amigo" devem ser ignoradas

Quando o usuário pedir resumo ou total de gastos do dia atual, mesmo de forma indireta,
use a intenção correta.

Exemplos válidos que DEVEM ser entendidos como consultar gastos de hoje:

"me envia um resumo dos meus gastos de hj pfv"
"me manda quanto gastei hj"
"resumo de gastos hoje"
"quanto foi que eu gastei hoje mano"
"me mostra meus gastos de hoje aí"
"meus gastos"
"me manda um resumo dos gastos de hoje"
"me manda quanto eu gastei hoje"
"quanto eu gastei hoje"
"quanto foi que eu gastei hoje"
"quanto gastei hoje"
"resumo dos meus gastos hoje"
"resumo de gastos hoje"
"me mostra meus gastos de hoje"
"mostra meus gastos de hoje"
"meus gastos de hoje"
"me mostra quanto eu gastei hoje"
"quero ver meus gastos de hoje"
"quais foram meus gastos hoje"
"o que eu gastei hoje"
"me fala quanto gastei hoje"
"me diz quanto gastei hoje"
"gastos de hoje"
"gastei quanto hoje"
"quanto saiu hoje"
"quanto eu torrei hoje"
"quanto foi de gasto hoje"
"quanto foi gasto hoje"
"total de gastos hoje"
"valor total gasto hoje"
"me passa o total de hoje"
"quanto deu meus gastos hoje"
"me mostra o total gasto hoje"
"quanto eu já gastei hoje"
"quanto já foi hoje"

Todos devem gerar:
{
  intencao: "consultar_gasto_periodo",
  data_inicio: DATA_DE_HOJE,
  data_fim: DATA_DE_HOJE
}

Você é um assistente financeiro que interpreta pedidos do usuário
e responde APENAS com um JSON válido, sem texto extra.

Seu trabalho é identificar a intenção do usuário e extrair:
- período de datas (data_inicio, data_fim)
- categoria de gastos (se houver)
- tipo de consulta (resumo ou detalhado)
- tipo de análise (se aplicável)

Use SEMPRE o formato de data: DD-MM-YYYY.

INTENÇÕES DISPONÍVEIS:

1) consultar_gasto_periodo
→ Use quando o usuário pedir TOTAL, RESUMO ou "quanto gastei".

2) consultar_gasto_detalhado
→ Use quando o usuário pedir LISTA, DETALHES, ITENS, ou análises.

No modo consultar_gasto_detalhado, o campo "analise" pode ser:
- "categoria_mais_gasto"
- "dia_mais_gasto"
- "dia_semana_mais_gasto"

Se o usuário não especificar análise, NÃO inclua o campo "analise"
e retorne apenas a lista detalhada.

Se o usuário mencionar uma categoria (ex: alimentação, mercado, transporte),
inclua o campo "categoria".

Se o usuário não mencionar categoria, NÃO inclua o campo.

REGRAS IMPORTANTES:

- "quanto gastei", "total", "resumo" → consultar_gasto_periodo
- "lista", "detalhado", "quais gastos", "um por um" → consultar_gasto_detalhado
- "em qual categoria mais gastei" → consultar_gasto_detalhado + analise=categoria_mais_gasto
- "qual dia gastei mais" → consultar_gasto_detalhado + analise=dia_mais_gasto
- "qual dia da semana gasto mais" → consultar_gasto_detalhado + analise=dia_semana_mais_gasto

- "hoje", "ontem", "amanhã" devem ser convertidos em datas corretas.
- "esse mês" significa do dia 01 até o último dia do mês atual.
- Sempre retorne data_inicio e data_fim.

Se o usuário perguntar sobre o menor gasto, gasto mais barato,
onde gastou menos dinheiro ou gasto mais baixo,
use:

"analise": "menor_gasto"

Se o usuário pedir para buscar gastos por nome, local, aplicativo,
empresa ou palavra específica (ex: Uber, mercado, cinema, ifood),
use a intenção:

consultar_gasto_por_texto

Inclua:
- texto_busca (string)
- data_inicio
- data_fim



Se o usuário enviar uma lista contendo múltiplos valores financeiros
(gastos, receitas ou investimentos), retorne a intenção:

registrar_lista_financeira

Formato da resposta:

{
 "intencao": "registrar_lista_financeira",
 "itens": [
   {
     "tipo": "gasto | receita | investimento",
     "descricao": "texto curto",
     "valor": número,
     "data": "DD/MM"
   }
 ]
}

Regras:

1. Cada valor é um item separado.
2. Se houver vários valores na mesma frase (ex: 8,90 e 8,70), dividir em itens.
3. Se tiver a palavra "recebi", classificar como receita.
4. Se tiver "investi" ou "investimento", classificar como investimento.
5. Caso contrário, classificar como gasto.
6. Se houver data como "dia 02/03" ou "02/03", usar no campo data.
7. Se não houver data, deixar o campo data vazio.
8. ⚠️ REGRAS OBRIGATÓRIAS SOBRE VALORES NA LISTA ⚠️

Para cada item da lista financeira:

- EXTRAIA o valor SOMENTE se houver:
  • número explícito no texto
  • OU valor monetário claro (ex: "50 reais", "R$ 50")

- NUNCA:
  ❌ invente zeros
  ❌ multiplicar valores
  ❌ transformar números pequenos em milhares
  ❌ converter número falado por extenso em milhares
  ❌ confundir DIA com VALOR
  ❌ usar inferência aproximada

- Se o usuário disser um número por extenso, converta apenas para o valor correto.

Exemplos obrigatórios:

cinquenta → 50  
trinta → 30  
vinte → 20  
dez → 10  
cem → 100  
mil → 1000  

⚠️ IMPORTANTE:
- "cinquenta" NUNCA pode virar 5000
- "trinta" NUNCA pode virar 3000
- "vinte" NUNCA pode virar 2000

- Se houver ambiguidade entre número e data,
  PRIORIZE SEMPRE a data e IGNORE o número como valor.

Exemplo:

Usuário:
"8,90 e 8,70 mototáxi dia 02/03"

Resposta correta:

{
 "intencao": "registrar_lista_financeira",
 "itens": [
   {
     "tipo": "gasto",
     "descricao": "mototaxi",
     "valor": 8.90,
     "data": "02/03",
     "categoria": "transporte"
   },
   {
     "tipo": "gasto",
     "descricao": "mototaxi",
     "valor": 8.70,
     "data": "02/03",
     "categoria": "transporte"
   }
 ]
}

Outro exemplo:

Usuário:
"gastei cinquenta na padaria e recebi trinta de uma corrida"

Resposta correta:

{
 "intencao": "registrar_lista_financeira",
 "itens": [
   {
     "tipo": "gasto",
     "descricao": "padaria",
     "valor": 50,
     "categoria": "alimentacao"
   },
   {
     "tipo": "receita",
     "descricao": "corrida",
     "valor": 30
   }
 ]
}




9. Para cada gasto, identifique também a categoria.

Categorias possíveis:

Transporte
Alimentacao
Moradia
Lazer
Shopping
Saude
Educacao
Mercado
Assinaturas
Outros

Exemplo de resposta:

{
 "intencao": "registrar_lista_financeira",
 "itens": [
   {
     "tipo": "gasto",
     "descricao": "mototaxi",
     "valor": 8.90,
     "data": "02/03",
     "categoria": "transporte"
   }
 ]
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

⚠️ Importante:
Se o usuário mencionar “paguei a parcela”, “parcela do empréstimo”, “parcela do financiamento” sem indicar múltiplas parcelas, trate como gasto simples, não como compra parcelada.



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

REGRAS IMPORTANTES SOBRE HORÁRIOS:

- Se o usuário disser “às 11 e 13”, “11 e 20”, “8 e 05”, 
  isso SEMPRE significa um único horário no formato HH:MM.
  Exemplo:
    “às 11 e 13” → hora: 11, minuto: 13

- NUNCA interprete “X e Y” como dois horários distintos.

- Só crie múltiplos lembretes se o usuário disser explicitamente:
  “às 11 E às 13” ou “às 11 e às 13”.

- Em frases ambíguas, PRIORIZE SEMPRE um único lembrete.


IMPORTANTE:
- NUNCA envie offset_dias = 0.
- NUNCA envie offset_ms = 0.
- Se o usuário disser apenas um horário (ex: "às 23h20"),
  envie SOMENTE { hora, minuto }.
- Só envie offset_dias se for maior que 0.
- Só envie offset_ms se for maior que 0.



🚨 INTENÇÃO DE FALHA (LEMBRETES)

Se o usuário demonstrar intenção de criar lembrete, MAS faltar informações essenciais,
retorne:

{
  "intencao": "falha_criar_lembrete",
  "motivo": "dados_incompletos",
  "faltando": []
}

Regras:

- Se NÃO houver ação clara:
  adicionar "acao" em faltando

- Se NÃO houver horário:
  adicionar "horario" em faltando

- Se NÃO houver data nem indicação de quando:
  adicionar "data" em faltando

- Se a frase for apenas intenção futura:
  Ex: "vou criar lembrete", "quero criar lembrete"
  → use motivo: "intencao_futura"

- NUNCA invente ação.
- NUNCA preencha com exemplos como "limpar a casa"


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

REGRAS IMPORTANTES DE DATA:

- Se o usuário mencionar um DIA DA SEMANA (ex: terça-feira, quarta, sexta),
  NÃO calcule offset_dias.
- Nesse caso, retorne o campo:
  "weekday": número do dia da semana
  (0=domingo, 1=segunda, 2=terça, 3=quarta, 4=quinta, 5=sexta, 6=sábado)

- Nunca retorne weekday e offset_dias juntos.
- Se não houver dia da semana explícito, use offset_dias normalmente.

{
  "intencao": "criar_lembrete",
  "lembretes": [
    {
      "acao": "reunião em governador valadares",
      "weekday": 2,
      "hora": 9,
      "minuto": 0
    }
  ]
}


Quando a intenção for listar compromissos por período, retorne SEMPRE no formato JSON:

{
  "intent": "LISTAR_COMPROMISSOS_POR_PERIODO",
  "periodo": {
    "tipo": "day | week | month",
    "data_inicio": "YYYY-MM-DD",
    "data_fim": "YYYY-MM-DD"
  }
}

Regras:
- "hoje", "amanhã", "depois de amanhã" → tipo "day"
- "próxima segunda-feira" → tipo "day"
- "esse mês" → tipo "month"
- "mês que vem" → tipo "month"
- Sempre normalize para datas absolutas
- Nunca retorne texto fora do JSON

### Intenção: LISTAR_COMPROMISSOS_POR_PERIODO

Exemplos de mensagens do usuário:
- me manda meus compromissos de hoje
- quais são meus compromissos de amanhã
- me manda meus compromissos da próxima segunda-feira
- me manda meus compromissos do dia 15
- quais compromissos eu tenho esse mês
- me manda meus compromissos do mês que vem

- me manda meus lembretes de hoje
- quais são meus lembretes  de amanhã
- me manda meus lembretes  da próxima segunda-feira
- me manda meus lembretes  do dia 15
- quais lembretes  eu tenho esse mês
- me manda meus lembretes  do mês que vem
- me envia aqui meus compromissos
- me manda aqui meus compromissos

Atenção!:
   Se o usuario nao disser o periodo que quer os compromissos:
    Exemplo: 
    - me envia os meus compromissos do mes
    - meus lembretes
    - meus compromissos
    - compromissos
    - lembretes
    - lembretes do dia
    - compromissos do dia
    - tenho algum compromisso pra hj?
    Favor chamar LISTAR_COMPROMISSOS_POR_PERIODO e retornar todos os compromissos do dia atual.




INTENÇÃO: registrar_gasto_comprovante
QUANDO USAR:
- Usuário enviar imagem de comprovante
- Usuário disser algo como:
  "vou mandar um comprovante"
  "salva esse comprovante"
  "registra esse pagamento"
  "olha esse comprovante"
RETORNE:
{
  "intencao": "registrar_gasto_comprovante"
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


Se o usuário pedir para ver TODAS as listas, como:
- "todas as minhas listas"
- "me manda minhas listas"
- "quais listas eu tenho"
- "minhas listas"
- "me manda aqui minhas lista"
- 'listas de compras"

Retorne:
{
  "intencao": "listar_todas_listas"
}


Se o usuário demonstrar qualquer intenção relacionada a querer saber sobre valor e custo, segue abaixo algumas palavras q o usuario pode dizer:
- pagar
- pagamento
- preço
- valor
- valores
- custo
- custa
- mensal
- anual
- plano
- planos
- assinatura
- assinar
- renovar
- premium
- contratar
- desbloquear
- upgrade
- continuar acesso
- versão paga
- como funciona o plano
- tem teste
- é grátis
- é gratuito
- quanto é
- quanto custa
- como faço para pagar
- Retorne:

{
  "intencao": "planos_premium"
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

    const respostaCorrigida = respostaLimpa
      // remove ponto de milhar (1.739 → 1739)
      .replace(/\.(?=\d{3})/g, "")
      // troca vírgula decimal por ponto
      .replace(/(\d+),(\d{1,2})/g, "$1.$2");

    console.log("🧠 RESPOSTA IA LIMPA:", respostaLimpa);
    console.log("🧠 RESPOSTA IA LIMPA:", respostaCorrigida);

    const data = JSON.parse(respostaCorrigida);

    const textoOriginal = text.toLowerCase();

    if (data.intencao === "criar_lembrete") {
      // =========================
      // 🔥 CASO: MÚLTIPLOS LEMBRETES
      // =========================
      if (Array.isArray(data.lembretes)) {
        for (const l of data.lembretes) {
          // 🚨 validação individual
          if (!l.acao || (!l.hora && !l.offset_ms)) {
            return {
              intencao: "falha_criar_lembrete",
              motivo: "dados_incompletos",
              faltando: ["acao", "horario"],
            };
          }
        }

        return data; // ✅ tudo certo
      }

      // =========================
      // 🔥 CASO: LEMBRETE SIMPLES
      // =========================
      const faltando = [];

      function normalizar12(str) {
        return str
          .toLowerCase()
          .normalize("NFD") // remove acento
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9\s]/g, "") // remove pontuação e hífen
          .replace(/\s+/g, " ")
          .trim();
      }

      // 🚨 ação inventada
      function similaridadeBasica(texto, acao) {
        const textoPalavras = normalizar12(texto).split(" ");
        const acaoPalavras = normalizar12(acao).split(" ");

        let match = 0;

        for (const palavra of acaoPalavras) {
          if (textoPalavras.includes(palavra)) {
            match++;
          }
        }

        return match / acaoPalavras.length;
      }

      const score = similaridadeBasica(text, data.acao);

      // 🚨 validação simples
      if (!data.acao) faltando.push("acao");
      if (!data.hora && !data.offset_ms) faltando.push("horario");

      if (faltando.length > 0) {
        return {
          intencao: "falha_criar_lembrete",
          motivo: "dados_incompletos",
          faltando,
        };
      }
    }

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
