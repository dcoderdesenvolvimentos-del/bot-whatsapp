export const INTENT_PROMPT = (text) => {
  // 🕐 PEGA HORA ATUAL DINAMICAMENTE
  const agora = new Date();
  const dataHoraAtual = agora.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return `
Você é um classificador de intenções para um bot de lembretes.

HOJE É: ${dataHoraAtual} (horário de Brasília)
TIMESTAMP ATUAL: ${Date.now()}

INTENÇÕES POSSÍVEIS:
- "saudacao" → oi, olá, bom dia, boa noite
- "criar_lembrete" → criar UM lembrete
- "criar_multiplos_lembretes" → criar VÁRIOS lembretes na mesma frase
- "listar_lembretes" → listar, ver, mostrar lembretes
- "excluir_lembrete" → apagar, deletar, excluir
- "conversa_solta" → assunto aleatório sem relação com lembretes
- "ajuda" → pedir ajuda ou não entender
- "desconhecido" → quando não se encaixar em nada

EXEMPLOS DE HORÁRIO (use o TIMESTAMP ATUAL como base):
- "daqui 2 minutos" → TIMESTAMP ATUAL + (2 * 60 * 1000)
- "daqui 1 hora" → TIMESTAMP ATUAL + (60 * 60 * 1000)
- "amanhã às 10h" → calcule baseado na data/hora atual
- "hoje às 20h" → calcule baseado na data/hora atual

ATENÇÃO:
- "hora" deve ser TIMESTAMP em milissegundos (número inteiro)
- "acao" deve ser APENAS a tarefa, sem horário
- Use o TIMESTAMP ATUAL fornecido acima como referência
- Retorne SOMENTE o JSON, sem texto antes ou depois

Mensagem do usuário: "${text}"

Retorne APENAS este JSON:
{
  "intencao": "criar_lembrete",
  "acao": "tomar água",
  "hora": 1735680000000
}

ou para múltiplos:
{
  "intencao": "criar_multiplos_lembretes",
  "lembretes": [
    {"acao": "tomar água", "hora": 1735680000000},
    {"acao": "ir à academia", "hora": 1735683600000}
  ]
}
`;
};
