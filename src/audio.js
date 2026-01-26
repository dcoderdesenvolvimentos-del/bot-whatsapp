import axios from "axios";
import fs from "fs";
import FormData from "form-data";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function audioToText(audioUrl) {
  try {
    // 1️⃣ Baixa o áudio
    const response = await axios.get(audioUrl, {
      responseType: "arraybuffer",
    });

    const filePath = "./temp-audio.ogg";
    fs.writeFileSync(filePath, response.data);

    // 2️⃣ Envia para o Whisper
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model: "whisper-1",
      language: "pt",
    });

    // 3️⃣ Limpa arquivo
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    return transcription.text;
  } catch (err) {
    console.error("❌ Erro ao transcrever áudio:", err.message);

    return "";
  }
}
