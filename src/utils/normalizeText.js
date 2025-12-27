const numbers = {
  um: 1,
  dois: 2,
  tres: 3,
  quatro: 4,
  cinco: 5,
};

export function normalizeText(text) {
  if (typeof text !== "string") return "";

  text = text.toLowerCase().trim();

  for (const [word, num] of Object.entries(numbers)) {
    text = text.replace(new RegExp(`\\b${word}\\b`, "g"), num);
  }

  return text;
}
