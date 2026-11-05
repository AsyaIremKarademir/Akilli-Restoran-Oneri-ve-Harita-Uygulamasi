import { describe, expect, it } from "vitest";
import { makePlace, ORIGIN, PREFS } from "@/test/fixtures";
import { buildAffinity, rankPlaces, scorePlace, WEIGHTS } from "./scoring";

describe("WEIGHTS", () => {
  it("toplamı 1 olmalı ki puan 0-100 aralığında kalsın", () => {
    const sum = Object.values(WEIGHTS).reduce((s, w) => s + w, 0);
    expect(sum).toBeCloseTo(1);
  });
});

describe("scorePlace — sert filtreler", () => {
  it("maksimum mesafenin dışındaki mekanı elemeli", () => {
    expect(scorePlace(makePlace({ meters: 2000 }), ORIGIN, PREFS, {})).toBeNull();
  });

  it("kullanıcının istemediği mekan türünü elemeli", () => {
    const prefs = { ...PREFS, placeTypes: ["cafe"] };
    expect(scorePlace(makePlace({ type: "restaurant" }), ORIGIN, prefs, {})).toBeNull();
  });

  it("beğenilmeyen (👎) mekanı önermemeli", () => {
    const place = makePlace();
    const votes = { [place.id]: { vote: -1, place, at: 0 } };
    expect(scorePlace(place, ORIGIN, PREFS, votes)).toBeNull();
  });

  it("vegan tercihinde açıkça vegan olmayan mekanı elemeli, bilinmeyeni elememeli", () => {
    const prefs = { ...PREFS, vegan: true };
    expect(scorePlace(makePlace({ vegan: false }), ORIGIN, prefs, {})).toBeNull();
    expect(scorePlace(makePlace({ vegan: undefined }), ORIGIN, prefs, {})).not.toBeNull();
  });
});

describe("scorePlace — puanlama", () => {
  it("puan 0-100 aralığında bir tam sayı olmalı", () => {
    const s = scorePlace(makePlace(), ORIGIN, PREFS, {});
    expect(Number.isInteger(s.score)).toBe(true);
    expect(s.score).toBeGreaterThanOrEqual(0);
    expect(s.score).toBeLessThanOrEqual(100);
  });

  it("tercih edilen mutfak eşleşmesi puanı artırmalı ve gerekçe üretmeli", () => {
    const prefs = { ...PREFS, cuisines: ["pizza"] };
    const pizza = scorePlace(makePlace({ categories: ["pizza"] }), ORIGIN, prefs, {});
    const kebab = scorePlace(makePlace({ categories: ["kebab"] }), ORIGIN, prefs, {});
    expect(pizza.score).toBeGreaterThan(kebab.score);
    expect(pizza.reasons).toContainEqual({ kind: "cuisine", category: "pizza" });
  });

  it("yakın mekan, aynı özellikteki uzak mekandan yüksek puan almalı", () => {
    const near = scorePlace(makePlace({ meters: 100 }), ORIGIN, PREFS, {});
    const far = scorePlace(makePlace({ meters: 1400 }), ORIGIN, PREFS, {});
    expect(near.score).toBeGreaterThan(far.score);
    expect(near.reasons.some((r) => r.kind === "near")).toBe(true);
  });

  it("bütçe dışı fiyat puanı düşürmeli", () => {
    const prefs = { ...PREFS, priceRange: [1, 1] };
    const cheap = scorePlace(makePlace({ priceLevel: 1 }), ORIGIN, prefs, {});
    const luxury = scorePlace(makePlace({ priceLevel: 4 }), ORIGIN, prefs, {});
    expect(cheap.breakdown.price).toBe(1);
    expect(luxury.breakdown.price).toBe(0);
  });

  it("tahmini fiyatın etkisi nötre doğru yumuşatılmalı", () => {
    const exact = scorePlace(makePlace({ priceLevel: 4, priceEstimated: false }), ORIGIN, PREFS, {});
    const estimated = scorePlace(makePlace({ priceLevel: 4, priceEstimated: true }), ORIGIN, PREFS, {});
    expect(estimated.breakdown.price).toBeGreaterThan(exact.breakdown.price);
  });

  it("daha önce beğenilen mekanı öne çıkarmalı", () => {
    const place = makePlace();
    const votes = { [place.id]: { vote: 1, place, at: 0 } };
    const s = scorePlace(place, ORIGIN, PREFS, votes);
    expect(s.breakdown.affinity).toBe(1);
    expect(s.reasons[0]).toEqual({ kind: "liked" });
  });
});

describe("buildAffinity — oylardan zevk profili", () => {
  it("beğenilen kategoriye pozitif, beğenilmeyene negatif değer vermeli", () => {
    const liked = makePlace({ id: "node/1", categories: ["kebab"] });
    const disliked = makePlace({ id: "node/2", categories: ["burger"] });
    const affinity = buildAffinity({
      [liked.id]: { vote: 1, place: liked, at: 0 },
      [disliked.id]: { vote: -1, place: disliked, at: 0 },
    });
    expect(affinity.kebab).toBeGreaterThan(0);
    expect(affinity.burger).toBeLessThan(0);
  });

  it("tek oy profili uç değere itmemeli (Laplace düzeltmesi)", () => {
    const p = makePlace({ categories: ["pizza"] });
    expect(buildAffinity({ [p.id]: { vote: 1, place: p, at: 0 } }).pizza).toBeCloseTo(1 / 3);
  });

  it("benzer mekanlara 'beğendiğin X mekanlarına benziyor' gerekçesi eklemeli", () => {
    const votes = {};
    for (let i = 0; i < 3; i++) {
      const p = makePlace({ id: `node/${i + 10}`, categories: ["kebab"] });
      votes[p.id] = { vote: 1, place: p, at: 0 };
    }
    const candidate = makePlace({ id: "node/99", categories: ["kebab"] });
    const s = scorePlace(candidate, ORIGIN, PREFS, votes);
    expect(s.reasons).toContainEqual({ kind: "similar", category: "kebab" });
  });
});

describe("rankPlaces", () => {
  it("puana göre azalan, eşitlikte yakınlığa göre sıralamalı ve elenenleri çıkarmalı", () => {
    const prefs = { ...PREFS, cuisines: ["pizza"] };
    const places = [
      makePlace({ id: "node/a", categories: ["kebab"], meters: 200 }),
      makePlace({ id: "node/b", categories: ["pizza"], meters: 800 }),
      makePlace({ id: "node/c", categories: ["pizza"], meters: 100 }),
      makePlace({ id: "node/d", categories: ["pizza"], meters: 3000 }),
    ];
    const ranked = rankPlaces(places, ORIGIN, prefs, {});
    expect(ranked.map((r) => r.place.id)).toEqual(["node/c", "node/b", "node/a"]);
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i - 1].score).toBeGreaterThanOrEqual(ranked[i].score);
    }
  });
});
