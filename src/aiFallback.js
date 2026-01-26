import OpenAI from "openai";

let client = null;

function getClient() {
  if (!process.env.OPENAI_API_KEY) return null;

  if (!client) {
    client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  return client;
}

export async function askIA(text) {
  const openai = getClient();
  if (!openai) return null;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    messages: [
      {
        role: "system",
        content: `
Você é um extrator de lembretes.
NÃO use UTC.
NÃO converta fuso horário.
NÃO converse com o usuário.

Quando houver um lembrete, responda APENAS em JSON:

{
  "action": "reminder",
  "text": "descrição do lembrete",
  "dayOffset": 0 | 1 | 2 | null,
  "weekday": 0-6 | null,
  "hour": 0-23,
  "minute": 0-59
}




Regras:
- "amanhã" => dayOffset = 1
- "depois de amanhã" => dayOffset = 2
- Dias da semana => weekday (0 = domingo)
- Se não entender, responda:
{ "action": "unknown" }
`,
      },
      { role: "user", content: text },
    ],
  });

  try {
    return JSON.parse(response.choices[0].message.content);
  } catch {
    return null;
  }
}
