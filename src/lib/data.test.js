import { describe, expect, it } from "vitest";
import { categorize, parseCuisineTag } from "./cuisines";
import { geoapifyToElement } from "./geoapify";
import { formatDistance, haversineDistance, isValidCoordinate, walkingMinutes } from "./geo";
import { buildOverpassQuery, normalizeElement, normalizeElements } from "./overpass";
import { estimatePrice, parseExplicitPrice } from "./price";

describe("geo", () => {
  it("Kızılay–Ulus arası mesafeyi doğru hesaplamalı (~2.6 km)", () => {
    const d = haversineDistance({ lat: 39.9208, lon: 32.8541 }, { lat: 39.9417, lon: 32.8543 });
    expect(d).toBeGreaterThan(2_250);
    expect(d).toBeLessThan(2_400);
  });

  it("mesafeyi okunabilir biçimde formatlamalı", () => {
    expect(formatDistance(347, "tr")).toBe("350 m");
    expect(formatDistance(1530, "tr")).toBe("1,5 km");
    expect(formatDistance(1530, "en")).toBe("1.5 km");
  });

  it("yürüme süresi en az 1 dakika olmalı", () => {
    expect(walkingMinutes(10)).toBe(1);
    expect(walkingMinutes(800)).toBe(10);
  });

  it("geçersiz koordinatları reddetmeli", () => {
    expect(isValidCoordinate(39.9, 32.8)).toBe(true);
    expect(isValidCoordinate(91, 0)).toBe(false);
    expect(isValidCoordinate(Number.NaN, 0)).toBe(false);
  });
});

describe("cuisines", () => {
  it("OSM cuisine etiketini ayrıştırmalı", () => {
    expect(parseCuisineTag("Pizza;italian, coffee shop")).toEqual(["pizza", "italian", "coffee_shop"]);
    expect(parseCuisineTag(undefined)).toEqual([]);
  });

  it("ham mutfakları uygulama kategorilerine eşlemeli", () => {
    expect(categorize(["doner", "kebab"], "fast_food")).toEqual(["kebab"]);
    expect(categorize(["turkish"], "restaurant")).toEqual(["homestyle"]);
    expect(categorize([], "cafe")).toEqual(["cafe"]);
    expect(categorize(["unknown_dish"], "restaurant")).toEqual(["other"]);
  });
});

describe("price", () => {
  it("açık fiyat etiketlerini okumalı", () => {
    expect(parseExplicitPrice({ price_range: "₺₺₺" })).toBe(3);
    expect(parseExplicitPrice({ "price:range": "$" })).toBe(1);
    expect(parseExplicitPrice({ stars: "5" })).toBe(4);
    expect(parseExplicitPrice({})).toBeNull();
  });

  it("fiyatı tür ve mutfaktan tahmin etmeli", () => {
    expect(estimatePrice("fast_food", ["kebab"])).toBe(1);
    expect(estimatePrice("restaurant", ["seafood"])).toBe(3);
    expect(estimatePrice("cafe", ["cafe"])).toBe(2);
  });
});

describe("overpass", () => {
  it("sorgu yarıçapını güvenli aralıkta tutmalı", () => {
    expect(buildOverpassQuery(39.9, 32.8, 99_999)).toContain("around:5000,39.9,32.8");
    expect(buildOverpassQuery(39.9, 32.8, 10)).toContain("around:100,");
  });

  it("node ve way öğelerini Place modeline dönüştürmeli", () => {
    const place = normalizeElement({
      type: "way",
      id: 42,
      center: { lat: 39.92, lon: 32.85 },
      tags: {
        amenity: "restaurant",
        name: "Lezzet Lokantası",
        cuisine: "turkish;kebab",
        "addr:street": "Atatürk Bulvarı",
        "addr:housenumber": "12",
        "addr:city": "Ankara",
        "diet:vegetarian": "yes",
        opening_hours: "Mo-Su 10:00-22:00",
      },
    });
    expect(place).toMatchObject({
      id: "way/42",
      lat: 39.92,
      categories: ["homestyle", "kebab"],
      address: "Atatürk Bulvarı No:12, Ankara",
      vegetarian: true,
      priceEstimated: true,
    });
  });

  it("adı, koordinatı olmayan veya desteklenmeyen öğeleri elemeli; tekrarları kaldırmalı", () => {
    const valid = { type: "node", id: 1, lat: 1, lon: 1, tags: { amenity: "cafe", name: "A" } };
    expect(normalizeElement({ ...valid, tags: { amenity: "cafe" } })).toBeNull();
    expect(normalizeElement({ ...valid, lat: undefined })).toBeNull();
    expect(normalizeElement({ ...valid, tags: { amenity: "bank", name: "Banka" } })).toBeNull();
    expect(normalizeElements([valid, valid])).toHaveLength(1);
  });
});

describe("geoapify", () => {
  it("ham OSM verisi varsa aynı OSM kimliğini ve etiketleri korumalı", () => {
    const el = geoapifyToElement({
      properties: {
        name: "Nico La Pizza",
        lat: 39.92,
        lon: 32.85,
        place_id: "abc",
        categories: ["catering", "catering.fast_food", "catering.fast_food.pizza"],
        address_line2: "Karanfil Sokağı 5, Ankara",
        datasource: { raw: { osm_type: "n", osm_id: 123, amenity: "fast_food", cuisine: "pizza;italian" } },
      },
    });
    expect(el).toMatchObject({ type: "node", id: 123 });
    const place = normalizeElement(el);
    expect(place).toMatchObject({ id: "node/123", type: "fast_food", categories: ["pizza", "italian"] });
    expect(place?.address).toBe("Karanfil Sokağı 5, Ankara");
  });

  it("ham veri yoksa tür ve mutfağı kategorilerden çıkarmalı", () => {
    const el = geoapifyToElement({
      properties: {
        name: "Burger Point",
        lat: 1,
        lon: 1,
        place_id: "xyz",
        categories: ["catering", "catering.restaurant", "catering.restaurant.burger"],
      },
    });
    expect(el?.tags).toMatchObject({ amenity: "restaurant", cuisine: "burger" });
  });
});
