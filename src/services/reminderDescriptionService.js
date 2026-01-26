import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function generateReminderDescription(titulo) {
  const prompt = `
Crie UMA frase curta, amigável e positiva sobre o lembrete abaixo.

Regras:
- Não altere o significado do lembrete
- Não invente informações
- Não mencione data ou hora
- Apenas uma frase
- Tom natural e humano

Lembrete: "${titulo}"
`;

  const response = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7,
  });

  return response.choices[0].message.content.trim();
}
