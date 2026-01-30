export async function analisarNotificacao(textoOCR) {
  const prompt = `
Você recebeu TEXTO de UMA NOTIFICAÇÃO BANCÁRIA (print do celular).

Exemplo real:
"Compra de R$ 78,95 em MAXPRO TEO…"
"há 45 min"

REGRAS OBRIGATÓRIAS:
- IGNORE hora do celular (ex: 18:17)
- IGNORE textos do sistema (status bar)
- NÃO invente data ou hora exata
- Se existir tempo relativo ("45min"), use como texto
- Extraia SOMENTE dados explícitos

Retorne JSON assim:

{
  "valor": 78.95,
  "estabelecimento": "MAXPRO TEO",
  "tempo_relativo": "há 45 minutos"
}

Se não achar valor:
{ "erro": "nenhum_valor_encontrado" }

Texto OCR:
"""${textoOCR}"""
`;

  const resposta = await chamarSuaIA(prompt);
  return JSON.parse(resposta);
}
