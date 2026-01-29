export async function analisarNotificacao(textoOCR) {
  const prompt = `
Você recebeu TEXTO extraído de UM PRINT DE NOTIFICAÇÃO BANCÁRIA.

Esse texto pode conter UMA ou VÁRIAS notificações de pagamento.

Sua tarefa:
- Encontrar TODOS os valores monetários em reais (R$).
- Para cada valor, identificar o nome do local ou pessoa associada (se houver).

REGRAS:
- NÃO invente informações.
- NÃO escolha um gasto por conta própria.
- Se não houver NENHUM valor, retorne erro.

Responda APENAS em JSON.

Formato esperado:

Se não encontrar valor:
{ "erro": "nenhum_valor_encontrado" }

Se encontrar UM gasto:
{
  "multiplos": false,
  "gastos": [
    { "valor": 45.90, "estabelecimento": "Uber" }
  ]
}

Se encontrar VÁRIOS gastos:
{
  "multiplos": true,
  "gastos": [
    { "valor": 45.90, "estabelecimento": "Uber" },
    { "valor": 120.00, "estabelecimento": "Mercado Livre" }
  ]
}

Texto OCR:
"""${textoOCR}"""
`;

  await salvarGasto({
    valor: gasto.valor,
    estabelecimento: gasto.estabelecimento,
    origem: "notificacao_bancaria",
    criado_em: new Date(),
  });

  const resposta = await chamarSuaIA(prompt); // mesma função que você já usa

  return JSON.parse(resposta);
}
