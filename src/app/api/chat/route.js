import { NextResponse } from "next/server";
import { buildSystemPrompt, MAX_CHAT_MESSAGES, MAX_CHAT_PLACES, MAX_MESSAGE_LENGTH, ruleBasedReply } from "@/lib/chat";

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash";
const GEMINI_FALLBACK_MODEL = "gemini-3.5-flash-lite";
const GEMINI_MODELS = [...new Set([GEMINI_MODEL, GEMINI_FALLBACK_MODEL])];
const RETRY_DELAY_MS = 600;
const DEFAULT_COOLDOWN_MS = 60_000;

/**
 * Kotası dolan modeller (model → tekrar denenebileceği zaman, ms). 429 alan bir modeli yeniden denemek
 * günlük kotayı boşa harcar ve her mesajı yavaşlatır; bekleme süresi bitene kadar doğrudan sonrakine geçeriz.
 */
const exhaustedUntil = new Map();

/** 429 gövdesindeki `retryDelay` ("67359s") değerini ms'ye çevirir. */
function retryDelayMs(text) {
  const m = text.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/);
  return m ? Number(m[1]) * 1000 : DEFAULT_COOLDOWN_MS;
}

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

  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: buildSystemPrompt(req) }] },
    contents,
    generationConfig: {
      temperature: 0.6,
      maxOutputTokens: 4096,
      thinkingConfig: { thinkingLevel: "low" },
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
  });
  const deadline = AbortSignal.timeout(25_000);

  const call = (model) =>
    fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body,
      signal: deadline,
    });

  let res;
  let lastError = "tüm modellerin kotası dolu";
  for (const model of GEMINI_MODELS) {
    if ((exhaustedUntil.get(model) ?? 0) > Date.now()) continue;
    res = await call(model);
    // 503 (geçici yoğunluk) aynı modelde bir kez daha denemeye değer; 429 (kota) değmez.
    if (res.status === 503) {
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      res = await call(model);
    }
    if (res.ok) break;
    const text = await res.text();
    lastError = `${model} HTTP ${res.status}: ${text.slice(0, 300)}`;
    if (res.status === 429) exhaustedUntil.set(model, Date.now() + retryDelayMs(text));
    res = undefined;
  }
  if (!res) throw new Error(`Gemini kullanılamadı (${lastError})`);

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
