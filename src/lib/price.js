const clamp = (n) => Math.min(4, Math.max(1, Math.round(n)));

/**
 * OSM'de bazı mekanlarda bulunan açık fiyat etiketlerini okur.
 * Desteklenenler: `price_range`/`price:range` ("$$", "₺₺", "1-4"), `stars`.
 */
export function parseExplicitPrice(tags) {
  const raw = tags["price_range"] ?? tags["price:range"] ?? tags["price_level"];
  if (raw) {
    const symbols = raw.match(/[$€£₺]/g);
    if (symbols) return clamp(symbols.length);
    const num = Number.parseInt(raw, 10);
    if (Number.isFinite(num) && num >= 1 && num <= 4) return clamp(num);
  }
  const stars = Number.parseFloat(tags["stars"] ?? "");
  if (Number.isFinite(stars)) return clamp(stars >= 4 ? 4 : stars >= 3 ? 3 : 2);
  return null;
}

/** Kategoriye göre ortalama fiyat seviyesi kayması */
const CATEGORY_PRICE_BIAS = {
  kebab: -0.5,
  homestyle: -0.5,
  sandwich: -0.75,
  chicken: -0.5,
  burger: -0.25,
  breakfast: 0,
  dessert: -0.25,
  grill: 1,
  seafood: 1,
  asian: 0.75,
  italian: 0.5,
  world: 0.5,
};

const TYPE_BASE = {
  fast_food: 1.25,
  cafe: 1.75,
  restaurant: 2.25,
};

/**
 * Fiyat bilgisi olmayan mekanlar için sezgisel tahmin.
 * Mekan türü temel seviyeyi, mutfak kategorileri ise sapmayı belirler.
 */
export function estimatePrice(type, categories) {
  const biases = categories.map((c) => CATEGORY_PRICE_BIAS[c]).filter((b) => b !== undefined);
  const bias = biases.length ? Math.max(...biases) : 0;
  return clamp(TYPE_BASE[type] + bias);
}

export function priceSymbols(level) {
  return "₺".repeat(level);
}
