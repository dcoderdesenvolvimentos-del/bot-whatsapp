import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function generateReminderDescription(titulo) {
  const prompt = `
Crie UMA única frase baseada no lembrete abaixo.

A frase deve seguir esta estrutura:
1. Começar com uma percepção leve, emocional ou inteligente sobre o tipo do lembrete
2. Trazer um pequeno significado (valor, benefício ou sensação)
3. Finalizar com uma promessa natural de que você vai lembrar o usuário

Estilo:
- Natural, humano e agradável
- Pode ser levemente divertido ou inteligente
- Evite frases robóticas ou repetitivas
- Varie o estilo entre: acolhedor, leve, inteligente ou motivacional

Regras:
- NÃO alterar o significado do lembrete
- NÃO inventar informações
- NÃO mencionar datas ou horários
- NÃO antecipe acontecimentos futuros como se fossem hoje
- NÃO falar como se o evento fosse hoje
- SEMPRE incluir a promessa de lembrar o usuário
- Apenas 1 frase (média, nem curta demais nem longa demais)

Objetivo:
Transformar o lembrete em algo mais agradável, importante ou interessante, enquanto reforça que você vai ajudar o usuário a não esquecer.


Lembrete: "${titulo}"
`;

  const response = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7,
  });

  return response.choices[0].message.content.trim();
}
