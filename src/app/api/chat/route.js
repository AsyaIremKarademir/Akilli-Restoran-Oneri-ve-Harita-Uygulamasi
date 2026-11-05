import { NextResponse } from "next/server";
import { buildSystemPrompt, MAX_CHAT_MESSAGES, MAX_CHAT_PLACES, MAX_MESSAGE_LENGTH, ruleBasedReply } from "@/lib/chat";

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash";

function sanitize(body) {
  const b = body;
  if (!b || !Array.isArray(b.messages) || !Array.isArray(b.places) || !b.preferences) return null;
  const messages = b.messages
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-MAX_CHAT_MESSAGES)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_MESSAGE_LENGTH) }));
  if (!messages.length || messages[messages.length - 1].role !== "user") return null;
  return {
    messages,
    locale: b.locale === "en" ? "en" : "tr",
    places: b.places.slice(0, MAX_CHAT_PLACES),
    preferences: b.preferences,
  };
}

async function askGemini(req, apiKey) {
  const firstUser = req.messages.findIndex((m) => m.role === "user");
  const contents = req.messages.slice(firstUser).map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: buildSystemPrompt(req) }] },
      contents,
      generationConfig: {
        temperature: 0.6,
        maxOutputTokens: 1024,
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            reply: { type: "STRING" },
            placeIds: { type: "ARRAY", items: { type: "STRING" } },
          },
          required: ["reply", "placeIds"],
        },
      },
    }),
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}: ${await res.text()}`);

  const json = await res.json();

  const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  const parsed = JSON.parse(text);
  if (!parsed.reply) throw new Error("Gemini boş yanıt döndü");

  const known = new Set(req.places.map((p) => p.id));
  return {
    reply: parsed.reply,
    placeIds: (parsed.placeIds ?? []).filter((id) => known.has(id)).slice(0, 5),
    mode: "ai",
  };
}

export async function POST(req) {
  const body = sanitize(await req.json().catch(() => null));
  if (!body) return NextResponse.json({ error: "Geçersiz istek" }, { status: 400 });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json(ruleBasedReply(body));

  try {
    return NextResponse.json(await askGemini(body, apiKey));
  } catch (err) {
    console.error("[api/chat] Gemini hatası, kural tabanlı moda geçiliyor:", err);
    return NextResponse.json(ruleBasedReply(body));
  }
}
