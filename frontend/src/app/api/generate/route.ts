import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { prompt } = await req.json();

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      messages: [
        {
          role: "system",
          content: "You are an expert software engineer. Generate clean, working code only. No explanation, no markdown fences, no commentary.",
        },
        { role: "user", content: prompt },
      ],
      max_tokens: 1000,
      temperature: 0.1,
    }),
  });

  const data = await response.json();
  console.log("Groq response:", JSON.stringify(data, null, 2));
  const code = data.choices?.[0]?.message?.content ?? "Generation failed";
  return NextResponse.json({ code });
}