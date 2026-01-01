import OpenAI from "openai";
import { INTENT_PROMPT } from "./prompt.js";
import { INTENTIONS } from "../constants/intentions.js";
import { parseTime } from "../utils/timeParser.js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function interpretMessage(text) {
  const hora = parseTime(text);

  if (hora) {
    return {
      intencao: INTENTIONS.CRIAR_LEMBRETE,
      acao: extractAction(text),
      hora,
    };
  }

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    messages: [{ role: "user", content: INTENT_PROMPT(text) }],
  });

  const raw = response.choices[0].message.content;

  return extractJSON(raw);

  function extractJSON(text) {
    const firstBrace = text.indexOf("{");
    const lastBrace = text.lastIndexOf("}");

    if (firstBrace === -1 || lastBrace === -1) {
      throw new Error("JSON não encontrado na resposta da IA");
    }

    const jsonString = text.slice(firstBrace, lastBrace + 1);
    return JSON.parse(jsonString);
  }
}
