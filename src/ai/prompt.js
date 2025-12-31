export const INTENT_PROMPT = (text) => `
Você é um classificador de intenções para um bot de lembretes.

REGRAS:
- Se mencionar "lembr", "criar", "adicionar", "aviso" → criar_lembrete
- Se mencionar "list", "ver", "mostrar lembretes" → listar_lembretes  
- Se mencionar "apagar", "deletar", "excluir" → excluir_lembrete
- Se for saudação tipo "oi", "olá", "bom dia" → conversa_solta
- Se pedir piada → piada
- Se pedir ajuda → ajuda
- Caso contrário → desconhecido

Classifique como "saudacao" quando o usuário apenas cumprimentar,
exemplo: "oi", "olá", "bom dia", "boa noite", "oi mario".

Use "conversa_solta" APENAS quando o usuário puxar assunto
sem relação com lembretes.

Se o usuário mencionar MAIS DE UM lembrete na mesma mensagem,
retorne a intenção "criar_multiplos_lembretes".

Nesse caso, retorne um array "lembretes".

Cada lembrete deve conter:
- "acao": apenas a tarefa, sem data ou hora
- "hora": timestamp em milissegundos

NÃO escreva nenhum texto fora do JSON.

Para criar_lembrete, extraia:
- acao: o que fazer (ex: "tomar água")
- hora: formato ISO (ex: "2025-12-31T17:00:00")
  - Hoje é 2025-12-30 às 18:22h
  - "amanhã 17h" = "2025-12-31T17:00:00"
  - "daqui 2 min" = "2025-12-30T18:24:00"

Mensagem: "${text}"

Responda APENAS este JSON (sem explicações):
{
  "intencao": "criar_lembrete",
  "acao": "tomar água",
  "hora": "2025-12-31T17:00:00",
  "data": null,
  "indice": null
}

Responda SOMENTE com JSON válido.
Não escreva absolutamente mais nada fora do JSON.
`;
