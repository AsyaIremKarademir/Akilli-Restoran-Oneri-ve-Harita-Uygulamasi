import { haversineDistance } from "./geo";

export const WEIGHTS = {
  cuisine: 0.35,
  distance: 0.25,
  price: 0.15,
  affinity: 0.15,
  extras: 0.1,
};

export function buildAffinity(votes) {
  const tally = {};
  for (const { vote, place } of Object.values(votes)) {
    for (const cat of place.categories) {
      const t = (tally[cat] ??= { sum: 0, count: 0 });
      t.sum += vote;
      t.count += 1;
    }
  }
  const affinity = {};
  for (const [cat, t] of Object.entries(tally)) {
    affinity[cat] = t.sum / (t.count + 2);
  }
  return affinity;
}

function cuisineScore(place, prefs) {
  if (prefs.cuisines.length === 0) return { value: 0.5 };
  const match = place.categories.find((c) => prefs.cuisines.includes(c));
  return match ? { value: 1, match } : { value: 0 };
}

function distanceScore(distance, maxDistance) {
  return Math.max(0, 1 - distance / maxDistance);
}

function priceScore(place, prefs) {
  const [min, max] = prefs.priceRange;
  const level = place.priceLevel;
  const gap = level < min ? min - level : level > max ? level - max : 0;
  const base = gap === 0 ? 1 : gap === 1 ? 0.4 : 0;
  return place.priceEstimated ? base * 0.8 + 0.1 : base;
}

function affinityScore(place, votes, affinity) {
  if (votes[place.id]?.vote === 1) return { value: 1, liked: true };
  let best;
  for (const cat of place.categories) {
    const a = affinity[cat];
    if (a !== undefined && (!best || a > best.a)) best = { cat, a };
  }
  if (!best) return { value: 0.5, liked: false };
  return { value: (best.a + 1) / 2, liked: false, similar: best.a > 0.2 ? best.cat : undefined };
}

function extrasScore(place, prefs) {
  const reasons = [];
  const checks = [];
  if (prefs.vegan) {
    checks.push(place.vegan ? 1 : place.vegan === false ? 0 : 0.3);
    if (place.vegan) reasons.push({ kind: "vegan" });
  }
  if (prefs.vegetarian) {
    const ok = place.vegetarian || place.vegan || place.categories.includes("vegetarian");
    checks.push(ok ? 1 : place.vegetarian === false ? 0 : 0.4);
    if (ok) reasons.push({ kind: "vegetarian" });
  }
  if (prefs.wheelchair) {
    checks.push(place.wheelchair ? 1 : place.wheelchair === false ? 0 : 0.3);
    if (place.wheelchair) reasons.push({ kind: "wheelchair" });
  }
  const info = [place.openingHours, place.address, place.phone ?? place.website].filter(Boolean).length / 3;
  checks.push(info);
  return { value: checks.reduce((s, c) => s + c, 0) / checks.length, reasons };
}

export function scorePlace(place, origin, prefs, votes, affinity = buildAffinity(votes)) {
  const distance = haversineDistance(origin, place);

  if (distance > prefs.maxDistance) return null;
  if (!prefs.placeTypes.includes(place.type)) return null;
  if (votes[place.id]?.vote === -1) return null;
  if (prefs.vegan && place.vegan === false) return null;

  const cuisine = cuisineScore(place, prefs);
  const dist = distanceScore(distance, prefs.maxDistance);
  const price = priceScore(place, prefs);
  const aff = affinityScore(place, votes, affinity);
  const extras = extrasScore(place, prefs);

  const breakdown = {
    cuisine: cuisine.value,
    distance: dist,
    price,
    affinity: aff.value,
    extras: extras.value,
  };
  const score = Math.round(100 * Object.keys(WEIGHTS).reduce((s, k) => s + WEIGHTS[k] * breakdown[k], 0));

  const reasons = [];
  if (aff.liked) reasons.push({ kind: "liked" });
  if (cuisine.match) reasons.push({ kind: "cuisine", category: cuisine.match });
  if (aff.similar && aff.similar !== cuisine.match) reasons.push({ kind: "similar", category: aff.similar });
  if (dist >= 0.6) reasons.push({ kind: "near", meters: distance });
  if (price >= 0.9) reasons.push({ kind: "budget" });
  reasons.push(...extras.reasons);

  return { place, distance, score, breakdown, reasons };
}

export function rankPlaces(places, origin, prefs, votes) {
  const affinity = buildAffinity(votes);
  return places
    .map((p) => scorePlace(p, origin, prefs, votes, affinity))
    .filter((s) => s !== null)
    .sort((a, b) => b.score - a.score || a.distance - b.distance);
}
