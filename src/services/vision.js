// services/vision.js
import vision from "@google-cloud/vision";

const client = new vision.ImageAnnotatorClient({
  credentials: JSON.parse(process.env.GOOGLE_VISION_CREDENTIALS),
});

export async function extrairTextoDaImagem(imageUrl) {
  const [result] = await client.textDetection(imageUrl);
  return result.fullTextAnnotation?.text || "";
}
