import OpenAI from "openai";
import { INTENT_PROMPT } from "./prompt.js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function interpretMessage(text) {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    messages: [
      { role: "user", content: INTENT_PROMPT(text) }
    ],
  });

  return JSON.parse(response.choices[0].message.content);
}