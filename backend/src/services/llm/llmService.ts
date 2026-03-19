import OpenAI from "openai";

const apiKey = process.env.LLM_API_KEY;

if (!apiKey) {
  throw new Error("LLM_API_KEY environment variable is not set.");
}

const client = new OpenAI({
  apiKey
});

export async function askLLM(prompt: string): Promise<string> {
  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "user",
        content: prompt
      }
    ],
    temperature: 0.3
  });

  return response.choices[0].message?.content || "";
}