import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function analisarListaFinanceira(text) {
  try {
    const prompt = `
Analise a mensagem do usuário e identifique registros financeiros.

Se houver múltiplos valores, retorne:

{
 "intencao": "registrar_lista_financeira",
 "itens": [
   {
     "tipo": "gasto | receita | investimento",
     "descricao": "texto curto",
     "valor": numero,
     "data": "DD/MM",
     "categoria": "Transporte | Alimentacao | Moradia | Lazer | Shopping | Saude | Educacao | Mercado | Assinaturas | Outros"
   }
 ]
}

Regras:

- cada valor é um item separado
- "recebi" → receita
- "investi" ou "investimento" → investimento
- caso contrário → gasto
- reconhecer datas como "02/03" ou "dia 02/03"
- se não houver data, deixar vazio
- identificar categoria quando possível

Mensagem:
"${text}"

Responda APENAS JSON válido.
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 300,
    });

    const respostaRaw = completion.choices[0].message.content;

    const respostaLimpa = respostaRaw
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();

    console.log("🧠 LISTA FINANCEIRA:", respostaLimpa);

    const data = JSON.parse(respostaLimpa);

    if (!data.itens) {
      return {
        intencao: "desconhecido",
      };
    }

    data.intencao = "registrar_lista_financeira";

    return data;
  } catch (error) {
    console.error("❌ Erro na IA lista financeira:", error);

    return {
      intencao: "desconhecido",
    };
  }
}
