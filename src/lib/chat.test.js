import { describe, expect, it } from "vitest";
import { buildSystemPrompt, detectCategories, ruleBasedReply, selectChatCandidates } from "./chat";

const place = (o) => ({
  id: "node/1",
  name: "Mekan",
  type: "restaurant",
  categories: ["other"],
  cuisines: [],
  distance: 500,
  priceLevel: 2,
  score: 50,
  ...o,
});

const request = (text, places, locale = "tr") => ({
  locale,
  messages: [{ role: "user", content: text }],
  places,
  preferences: { cuisines: [], maxDistance: 1500, priceRange: [1, 3] },
});

const PLACES = [
  place({ id: "node/1", name: "Pizzacı Altan", categories: ["pizza"], priceLevel: 2, score: 60, distance: 900 }),
  place({
    id: "node/2",
    name: "Domino's",
    type: "fast_food",
    categories: ["pizza"],
    priceLevel: 1,
    score: 55,
    distance: 300,
  }),
  place({
    id: "node/3",
    name: "Her Şey Pastanesi",
    type: "cafe",
    categories: ["pizza", "cafe", "dessert"],
    score: 80,
    distance: 200,
  }),
  place({ id: "node/4", name: "Balıkçı", categories: ["seafood"], priceLevel: 3, score: 70, distance: 1200 }),
  place({ id: "node/5", name: "Kahveci", type: "cafe", categories: ["cafe"], priceLevel: 2, score: 65, distance: 150 }),
];

describe("detectCategories", () => {
  it("Türkçe ve İngilizce anahtar kelimeleri yakalamalı", () => {
    expect(detectCategories("Canım döner çekti")).toContain("kebab");
    expect(detectCategories("Is there any sushi?")).toContain("asian");
    expect(detectCategories("Kahve içmek istiyorum")).toContain("cafe");
  });

  it("kısa kelimeleri başka kelimelerin içinde yanlışlıkla eşlememeli", () => {
    expect(detectCategories("Bunun için detaylı bilgi")).toEqual([]);
    expect(detectCategories("Biraz et yemek istiyorum")).toContain("grill");
  });
});

describe("ruleBasedReply", () => {
  it("mutfağa göre filtrelemeli ve uzmanlaşmış mekanı öne almalı", () => {
    const res = ruleBasedReply(request("pizza önerir misin", PLACES));
    expect(res.mode).toBe("rules");
    expect(res.placeIds[0]).toBe("node/1");
    expect(res.placeIds).not.toContain("node/4");
  });

  it("'ucuz' ve 'yakın' ipuçlarını uygulamalı", () => {
    const res = ruleBasedReply(request("yakında ucuz pizza", PLACES));
    expect(res.placeIds[0]).toBe("node/2");
  });

  it("Türkçe yanıtı Türkçe büyük harf kuralıyla başlatmalı (i → İ)", () => {
    const res = ruleBasedReply(request("pizza", PLACES));
    expect(res.reply.startsWith("İstediğin")).toBe(true);
  });

  it("istenen mutfak bulunamazsa 'istediğin mutfağa göre' dememeli", () => {
    const res = ruleBasedReply(request("sushi", PLACES));
    expect(res.reply).not.toMatch(/mutfağa/);
  });

  it("eşleşme yoksa açıklayıcı bir mesaj dönmeli", () => {
    const res = ruleBasedReply(request("lüks bir yer", [place({ priceLevel: 1 })]));
    expect(res.placeIds).toEqual([]);
    expect(res.reply).toMatch(/bulamadım/);
  });

  it("İngilizce yanıt verebilmeli", () => {
    const res = ruleBasedReply(request("coffee please", PLACES, "en"));
    expect(res.reply).toMatch(/Top picks/);
    expect(res.placeIds).toContain("node/5");
  });
});

describe("selectChatCandidates", () => {
  it("mesajda geçen mutfaktaki mekanları, puanı düşük ve uzak olsalar bile listeye almalı", () => {
    const scored = Array.from({ length: 100 }, (_, i) => ({
      place: { id: `node/${i}`, name: `Kafe ${i}`, type: "cafe", categories: ["cafe"], cuisines: [], priceLevel: 2 },
      distance: 100 + i,
      score: 90 - i * 0.1,
    }));
    scored.push({
      place: {
        id: "node/pizza",
        name: "Pizzacı",
        type: "restaurant",
        categories: ["pizza"],
        cuisines: [],
        priceLevel: 1,
      },
      distance: 1400,
      score: 10,
    });
    const ids = selectChatCandidates(scored, "yakında ucuz pizza").map((p) => p.id);
    expect(ids).toContain("node/pizza");
    expect(ids.length).toBeLessThanOrEqual(60);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("buildSystemPrompt", () => {
  it("aday mekanları ve dili içermeli", () => {
    const prompt = buildSystemPrompt(request("merhaba", PLACES));
    expect(prompt).toContain("Türkçe");
    expect(prompt).toContain("node/2 | Domino's");
    expect(prompt).toMatch(/ONLY places from the CANDIDATES/);
  });
});
