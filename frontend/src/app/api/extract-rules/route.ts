import { NextRequest, NextResponse } from "next/server";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.1-8b-instant";

const EXTRACT_SYSTEM = `You are a Staff Engineer extracting enforceable coding standards from Architecture Decision Records (ADRs) or technical documentation.

Your job: read the document and extract ATOMIC, SPECIFIC, ENFORCEABLE rules that a code generator must follow.

Rules for good rule extraction:
- Each rule must be ONE specific requirement (not "follow good practices")
- Each rule must be actionable by a code generator
- Use MUST / MUST NOT / ALWAYS / NEVER language
- Include the WHY briefly if it helps enforcement
- Ignore rationale sections, history, and background — extract only requirements
- Extract 5-15 rules per document

Return ONLY a valid JSON array. No explanation, no markdown fences, no preamble.

Format:
[
  {
    "topic": "Short descriptive topic (e.g. State Management — Library)",
    "rule_text": "Full enforceable rule text using MUST/NEVER language..."
  }
]`;

export async function POST(req: NextRequest) {
  const { adrText, domain } = await req.json();

  if (!adrText?.trim()) {
    return NextResponse.json({ error: "No ADR text provided" }, { status: 400 });
  }

  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) {
    return NextResponse.json({ error: "GROQ_API_KEY not configured" }, { status: 500 });
  }

  const userMsg = `Domain context: ${domain}\n\nDocument:\n\n${adrText.slice(0, 8000)}`;

  const groqRes = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${groqKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: EXTRACT_SYSTEM },
        { role: "user", content: userMsg },
      ],
      temperature: 0.1,
      max_tokens: 2048,
    }),
  });

  if (!groqRes.ok) {
    const err = await groqRes.text();
    return NextResponse.json({ error: `Groq error: ${err}` }, { status: 500 });
  }

  const groqData = await groqRes.json();
  let raw: string = groqData.choices?.[0]?.message?.content ?? "";

  // Strip markdown fences if Groq wraps in them
  raw = raw.replace(/^```json?\n?/, "").replace(/\n?```$/, "").trim();

  try {
    const rules = JSON.parse(raw);
    if (!Array.isArray(rules)) throw new Error("Not an array");
    return NextResponse.json({
      rules,
      tokensUsed: groqData.usage?.total_tokens ?? 0,
    });
  } catch {
    return NextResponse.json(
      { error: "Groq returned malformed JSON", raw: raw.slice(0, 300) },
      { status: 500 }
    );
  }
}