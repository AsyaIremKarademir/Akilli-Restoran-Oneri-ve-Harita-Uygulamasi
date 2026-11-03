/**
 * Geoapify Places API (OpenStreetMap tabanlı) yanıtını, Overpass öğesi biçimine dönüştürür.
 * Böylece her iki kaynak da aynı `normalizeElement` fonksiyonundan geçer ve tek bir veri modeli korunur.
 */

const AMENITY_CATEGORIES = [
  ["catering.fast_food", "fast_food"],
  ["catering.cafe", "cafe"],
  ["catering.restaurant", "restaurant"],
];

export function buildGeoapifyUrl(lat, lon, radius, apiKey, lang) {
  const params = new URLSearchParams({
    categories: AMENITY_CATEGORIES.map(([c]) => c).join(","),
    filter: `circle:${lon},${lat},${Math.round(radius)}`,
    bias: `proximity:${lon},${lat}`,
    limit: "500",
    lang,
    apiKey,
  });
  return `https://api.geoapify.com/v2/places?${params}`;
}

const OSM_TYPES = { n: "node", w: "way", r: "relation" };

export function geoapifyToElement(feature) {
  const p = feature.properties;
  const raw = p.datasource?.raw ?? {};
  const categories = p.categories ?? [];

  const amenity =
    (typeof raw.amenity === "string" && raw.amenity) ||
    AMENITY_CATEGORIES.find(([c]) => categories.some((x) => x === c || x.startsWith(`${c}.`)))?.[1];
  if (!amenity) return null;

  // Ham OSM "cuisine" etiketi yoksa mutfak bilgisi "catering.restaurant.pizza" gibi alt kategorilerden çıkarılır.
  const cuisine =
    (typeof raw.cuisine === "string" && raw.cuisine) ||
    categories
      .filter((c) => c.startsWith("catering.") && c.split(".").length === 3)
      .map((c) => c.split(".")[2])
      .join(";") ||
    undefined;

  const tags = {};
  for (const [k, v] of Object.entries(raw)) tags[k] = String(v);
  Object.assign(tags, {
    amenity,
    name: p.name ?? tags.name ?? "",
    ...(cuisine && { cuisine }),
    ...(p.opening_hours && !tags.opening_hours && { opening_hours: p.opening_hours }),
    ...(p.website && !tags.website && { website: p.website }),
    ...(p.contact?.phone && !tags.phone && { phone: p.contact.phone }),
  });
  // Geoapify'ın biçimlendirilmiş adresi, OSM'de adres etiketi olmayan mekanlar için de dolu gelir.
  if (!tags["addr:street"] && !tags["addr:full"] && p.address_line2) tags["addr:full"] = p.address_line2;

  const osmType = typeof raw.osm_type === "string" ? OSM_TYPES[raw.osm_type] : undefined;
  const osmId = Number(raw.osm_id);
  return {
    type: osmType ?? "node",
    // OSM kimliği varsa kullanılır; böylece iki kaynaktan gelen aynı mekan aynı id'yi taşır ve oylar korunur.
    id: osmType && Number.isFinite(osmId) ? Math.abs(osmId) : hashId(p.place_id),
    lat: p.lat,
    lon: p.lon,
    tags,
  };
}

/** OSM kimliği olmayan kayıtlar için place_id'den kararlı bir sayısal kimlik üretir. */
function hashId(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
