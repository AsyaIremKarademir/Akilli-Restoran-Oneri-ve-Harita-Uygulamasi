import { NextResponse } from "next/server";
import { TtlCache } from "@/lib/cache";
import { isValidCoordinate } from "@/lib/geo";
import { MAX_RADIUS_M, normalizeElements } from "@/lib/overpass";
import { fetchPlaceElements } from "@/lib/place-sources";

const cache = new TtlCache(15 * 60 * 1000);
/** Aynı anahtar için süren sorgular; eşzamanlı istekler tek bir dış API çağrısını paylaşır. */
const inflight = new Map();

/** Yarıçap 500 m'lik dilimlere yuvarlanır; yakın istekler aynı önbelleği paylaşır. */
const bucket = (radius) => Math.ceil(radius / 500) * 500;

/**
 * GET /api/places?lat=39.92&lon=32.85&radius=1500
 * Verilen konum çevresindeki restoran, fast-food ve kafeleri getirir (Geoapify → Overpass yedekli).
 */
export async function GET(req) {
  const params = req.nextUrl.searchParams;
  const lat = Number.parseFloat(params.get("lat") ?? "");
  const lon = Number.parseFloat(params.get("lon") ?? "");
  const radius = Math.min(Number.parseInt(params.get("radius") ?? "1500", 10) || 1500, MAX_RADIUS_M);

  if (!isValidCoordinate(lat, lon)) {
    return NextResponse.json({ error: "Geçersiz koordinat" }, { status: 400 });
  }

  // Koordinatlar ~100 m hassasiyete yuvarlanır. Sorgu bu yuvarlanmış merkez ve dilimin üst yarıçapı
  // (+ yuvarlama payı) ile yapılır; böylece aynı önbellek anahtarına düşen tüm istekler için sonuç eksiksiz olur.
  const cLat = Number(lat.toFixed(3));
  const cLon = Number(lon.toFixed(3));
  const key = `${cLat},${cLon},${bucket(radius)}`;
  const cached = cache.get(key);
  if (cached) {
    return NextResponse.json(cached, { headers: { "X-Cache": "HIT" } });
  }

  try {
    let pending = inflight.get(key);
    if (!pending) {
      pending = fetchPlaceElements(cLat, cLon, bucket(radius) + 100)
        .then(({ elements, source }) => {
          const body = { places: normalizeElements(elements), source, fetchedAt: Date.now() };
          cache.set(key, body);
          return body;
        })
        .finally(() => inflight.delete(key));
      inflight.set(key, pending);
    }
    return NextResponse.json(await pending, { headers: { "X-Cache": "MISS" } });
  } catch (err) {
    console.error("[api/places] Tüm veri kaynakları başarısız:", err);
    return NextResponse.json({ error: "Mekan verisi şu anda alınamıyor" }, { status: 502 });
  }
}
