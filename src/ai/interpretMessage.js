import OpenAI from "openai";
import { INTENT_PROMPT } from "./prompt.js";
import { INTENTIONS } from "../constants/intentions.js";
import { parseTime } from "../utils/timeParser.js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function interpretMessage(text) {
  function extractAction(text) {
    if (!text) return "";

    return (
      text
        .toLowerCase()
        // remove chamadas
        .replace(/cara|mano|ei|por favor|pfv/gi, "")
        // remove comandos
        .replace(
          /me lembra|me lembre|lembra|lembrar|quero que você me lembre/gi,
          ""
        )
        // remove tempo comum
        .replace(/amanhã|hoje|depois de amanhã/gi, "")
        .replace(/daqui\s+\d+\s+(minuto|minutos|hora|horas)/gi, "")
        .replace(/às?\s*\d{1,2}(:\d{1,2})?/gi, "")
        .replace(/dia\s+\d{1,2}/gi, "")
        .replace(
          /próxima?\s+(segunda|terça|terca|quarta|quinta|sexta|sábado|sabado|domingo)/gi,
          ""
        )
        // limpeza final
        .replace(/\s+/g, " ")
        .trim()
    );
  }

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
