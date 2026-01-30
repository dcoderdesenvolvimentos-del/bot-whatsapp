export async function analisarNotificacao(textoOCR) {
  const prompt = `
Você recebeu TEXTO extraído de UMA IMAGEM.

Sua tarefa é APENAS classificar o tipo da imagem.

Tipos possíveis:
- notificacao_bancaria
- comprovante_fiscal
- desconhecido

Regras:
- Notificação bancária: menciona banco (Nubank, Inter, C6, etc),
  compra aprovada, débito/crédito, valor em reais.
- Comprovante fiscal: cupom, CNPJ, NFC-e, itens, subtotal, total.
- NÃO invente.
- Responda SOMENTE em JSON.

Formato:
{ "tipo": "notificacao_bancaria" }
`;

  const resposta = await chamarSuaIA(`
${prompt}

Texto OCR:
"""${textoOCR}"""
`);

  return JSON.parse(resposta);
}
