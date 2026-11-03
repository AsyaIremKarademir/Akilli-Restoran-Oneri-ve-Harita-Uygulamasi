import { categorize, parseCuisineTag } from "./cuisines";
import { estimatePrice, parseExplicitPrice } from "./price";

/**
 * Herkese açık Overpass sunucuları. Hepsi zaman zaman yoğunluk nedeniyle hata verebildiği için
 * istekler kademeli olarak (hedged request) birden fazla sunucuya dağıtılır; bkz. lib/place-sources.js.
 * OVERPASS_URL ortam değişkeniyle listenin başına özel bir sunucu eklenebilir.
 */
export const OVERPASS_ENDPOINTS = [
  ...(process.env.OVERPASS_URL ? [process.env.OVERPASS_URL] : []),
  "https://overpass-api.de/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

export const MAX_RADIUS_M = 5000;

/**
 * Verilen nokta çevresindeki restoran, fast-food ve kafeleri getiren Overpass QL sorgusu.
 * `nwr` ile hem nokta hem de bina olarak çizilmiş mekanlar alınır; `out center` binaların merkez koordinatını verir.
 */
export function buildOverpassQuery(lat, lon, radius) {
  const r = Math.round(Math.min(Math.max(radius, 100), MAX_RADIUS_M));
  return `[out:json][timeout:25];
nwr["amenity"~"^(restaurant|fast_food|cafe)$"]["name"](around:${r},${lat},${lon});
out center tags 600;`;
}

const yes = (v) => (v === undefined ? undefined : v === "yes" || v === "only");

export function formatAddress(tags) {
  if (tags["addr:full"]) return tags["addr:full"];
  const street = [tags["addr:street"], tags["addr:housenumber"]].filter(Boolean).join(" No:");
  const area = [tags["addr:neighbourhood"] ?? tags["addr:suburb"], tags["addr:district"], tags["addr:city"]]
    .filter(Boolean)
    .join(", ");
  const parts = [street, area].filter(Boolean);
  return parts.length ? parts.join(", ") : undefined;
}

/** Ham Overpass öğesini uygulamanın Place modeline dönüştürür. Koordinatı veya adı olmayan öğeler elenir. */
export function normalizeElement(el) {
  const tags = el.tags ?? {};
  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  const name = tags["name"]?.trim();
  if (lat === undefined || lon === undefined || !name) return null;

  const type = tags["amenity"];
  if (type !== "restaurant" && type !== "fast_food" && type !== "cafe") return null;

  const cuisines = parseCuisineTag(tags["cuisine"]);
  const categories = categorize(cuisines, type);
  const explicitPrice = parseExplicitPrice(tags);

  return {
    id: `${el.type}/${el.id}`,
    name,
    type,
    cuisines,
    categories,
    lat,
    lon,
    address: formatAddress(tags),
    openingHours: tags["opening_hours"],
    phone: tags["phone"] ?? tags["contact:phone"],
    website: tags["website"] ?? tags["contact:website"] ?? tags["contact:instagram"],
    priceLevel: explicitPrice ?? estimatePrice(type, categories),
    priceEstimated: explicitPrice === null,
    vegetarian: yes(tags["diet:vegetarian"]),
    vegan: yes(tags["diet:vegan"]),
    wheelchair: yes(tags["wheelchair"]),
    outdoorSeating: yes(tags["outdoor_seating"]),
    takeaway: yes(tags["takeaway"]),
    delivery: yes(tags["delivery"]),
  };
}

export function normalizeElements(elements) {
  const seen = new Set();
  const places = [];
  for (const el of elements) {
    const place = normalizeElement(el);
    if (!place || seen.has(place.id)) continue;
    seen.add(place.id);
    places.push(place);
  }
  return places;
}
