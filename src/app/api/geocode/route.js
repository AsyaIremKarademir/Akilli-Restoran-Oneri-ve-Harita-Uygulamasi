import { NextResponse } from "next/server";
import { TtlCache } from "@/lib/cache";
import { isValidCoordinate } from "@/lib/geo";

const cache = new TtlCache(24 * 60 * 60 * 1000, 1000);

/**
 * GET /api/geocode?lat=..&lon=..&lang=tr
 * OSM'de adresi olmayan mekanlar için Nominatim ters coğrafi kodlama. Yalnızca kullanıcı bir mekanı
 * açtığında çağrılır; Nominatim kullanım politikasına (saniyede 1 istek) uymak için sonuçlar önbelleğe alınır.
 */
export async function GET(req) {
  const params = req.nextUrl.searchParams;
  const lat = Number.parseFloat(params.get("lat") ?? "");
  const lon = Number.parseFloat(params.get("lon") ?? "");
  const lang = params.get("lang") === "en" ? "en" : "tr";
  if (!isValidCoordinate(lat, lon)) {
    return NextResponse.json({ error: "Geçersiz koordinat" }, { status: 400 });
  }

  const key = `${lat.toFixed(5)},${lon.toFixed(5)},${lang}`;
  const cached = cache.get(key);
  if (cached !== undefined) return NextResponse.json({ address: cached });

  try {
    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.search = new URLSearchParams({
      lat: String(lat),
      lon: String(lon),
      format: "jsonv2",
      zoom: "18",
      "accept-language": lang,
    }).toString();
    const res = await fetch(url, {
      headers: { "User-Agent": "LezzetRadari/1.0 (restaurant recommendation demo)" },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const a = json.address ?? {};
    const street = [a.road, a.house_number].filter(Boolean).join(" No:");
    const parts = [street, a.suburb ?? a.neighbourhood ?? a.quarter, a.town ?? a.city_district, a.province ?? a.city];
    const address = parts.filter(Boolean).join(", ") || null;
    cache.set(key, address);
    return NextResponse.json({ address });
  } catch (err) {
    console.error("[api/geocode] Nominatim hatası:", err);
    return NextResponse.json({ address: null }, { status: 502 });
  }
}
