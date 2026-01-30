import vision from "@google-cloud/vision";

const visionClient = new vision.ImageAnnotatorClient({
  credentials: JSON.parse(process.env.GOOGLE_VISION_CREDENTIALS),
});

export async function extrairTextoDaImagem(imageBase64) {
  const buffer = Buffer.from(imageBase64, "base64");

  const [result] = await visionClient.textDetection({
    image: { content: buffer },
  });

  const detections = result.textAnnotations;
  if (!detections || detections.length === 0) return "";

  // 🔥 texto OCR bruto
  return detections[0].description;
}
