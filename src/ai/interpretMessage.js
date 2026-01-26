import OpenAI from "openai";
import { INTENT_PROMPT } from "./prompt.js";
import { INTENTIONS } from "../constants/intentions.js";
import { parseTime } from "../utils/timeParser.js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function interpretMessage(text) {
  const lower = text.toLowerCase(); // 🔥 FALTAVA ISSO

  const hora = parseTime(text);

  function extractAction(text) {
    if (!text) return "";

    return (
      text
        .toLowerCase()

        // palavras de chamada
        .replace(/\b(cara|mano|ei|mario|parceiro|por favor|pfv)\b/gi, "")

        // comandos
        .replace(
          /\b(me lembra|me lembre|lembra|lembrar|lembre|lembre|quero que você me lembre)\b/gi,
          ""
        )

        // datas relativas
        .replace(/\b(hoje|amanhã|depois de amanhã)\b/gi, "")

        // dias da semana
        .replace(
          /\b(domingo|segunda|terça|terca|quarta|quinta|sexta|sábado|sabado)\b/gi,
          ""
        )

        // expressões de tempo
        .replace(/\b(daqui\s+\d+\s+(minuto|minutos|hora|horas))\b/gi, "")
        .replace(/\b(\d{1,2})\s*(horas?|h)\b/gi, "")
        .replace(/\bàs?\s*\d{1,2}(:\d{1,2})?\b/gi, "")

        // palavras soltas inúteis
        .replace(/\b(de|para|pra|que|às|umas)\b/gi, "")

        // limpeza final
        .replace(/\s+/g, " ")
        .trim()
    );
  }

  if (lower.includes("amanhã")) {
    const hourMatch = lower.match(/(\d{1,2})(?:[:h ](\d{1,2}))?/);
    const hour = hourMatch ? Number(hourMatch[1]) : 9;
    const minute = hourMatch && hourMatch[2] ? Number(hourMatch[2]) : 0;

    const now = new Date();

    const date = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1, // 🔥 amanhã REAL
      hour,
      minute,
      0,
      0
    );

    return date.getTime();
  }

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
