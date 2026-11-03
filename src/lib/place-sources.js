import { buildGeoapifyUrl, geoapifyToElement } from "./geoapify";
import { buildOverpassQuery, OVERPASS_ENDPOINTS } from "./overpass";

/**
 * Mekan verisi sağlayıcıları. GEOAPIFY_API_KEY tanımlıysa önce Geoapify (hızlı, kotalı) denenir;
 * başarısız olursa veya anahtar yoksa herkese açık Overpass sunucularına düşülür.
 */

const USER_AGENT = "LezzetRadari/1.0 (restaurant recommendation demo)";
/** Bir Overpass sunucusu bu süre içinde yanıt vermezse sıradaki sunucuya da paralel istek atılır. */
const HEDGE_DELAY_MS = 4_000;
const REQUEST_TIMEOUT_MS = 25_000;

async function fetchOverpassFrom(endpoint, query, signal) {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      // Overpass sunucuları anlamlı bir User-Agent olmayan istekleri reddediyor (406/429).
      "User-Agent": USER_AGENT,
    },
    body: new URLSearchParams({ data: query }),
    signal: AbortSignal.any([signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]),
    cache: "no-store",
  });
  const host = new URL(endpoint).host;
  if (!res.ok) throw new Error(`${host} → HTTP ${res.status}`);
  const json = await res.json();
  // Overpass zaman aşımı gibi hataları bazen HTTP 200 + "remark" alanıyla bildirir.
  if (!json.elements || (json.elements.length === 0 && json.remark)) {
    throw new Error(`${host} → ${json.remark ?? "boş yanıt"}`);
  }
  return { elements: json.elements, source: `overpass (${host})` };
}

/**
 * "Hedged request" stratejisi: önce ilk sunucuya istek atılır; HEDGE_DELAY_MS içinde yanıt gelmezse
 * veya hata alınırsa sıradaki sunucu da devreye girer. İlk başarılı yanıt kullanılır, diğerleri iptal edilir.
 * Böylece tek bir yoğun sunucu tüm uygulamayı yavaşlatmaz, sunuculara da gereksiz yük bindirilmez.
 */
export function fetchFromOverpass(lat, lon, radius) {
  const query = buildOverpassQuery(lat, lon, radius);
  const controller = new AbortController();
  const errors = [];

  return new Promise((resolve, reject) => {
    let started = 0;
    let finished = 0;
    let timer;

    const launchNext = () => {
      clearTimeout(timer);
      if (started >= OVERPASS_ENDPOINTS.length || controller.signal.aborted) return;
      const endpoint = OVERPASS_ENDPOINTS[started++];
      timer = setTimeout(launchNext, HEDGE_DELAY_MS);
      fetchOverpassFrom(endpoint, query, controller.signal).then(
        (result) => {
          clearTimeout(timer);
          controller.abort();
          resolve(result);
        },
        (err) => {
          errors.push(err.message);
          finished++;
          if (controller.signal.aborted) return;
          if (started < OVERPASS_ENDPOINTS.length) launchNext();
          else if (finished === started) reject(new Error(errors.join(" | ")));
        },
      );
    };
    launchNext();
  });
}

export async function fetchFromGeoapify(lat, lon, radius, apiKey, lang = "tr") {
  const res = await fetch(buildGeoapifyUrl(lat, lon, radius, apiKey, lang), {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`geoapify → HTTP ${res.status}`);
  const json = await res.json();
  const elements = (json.features ?? []).map(geoapifyToElement).filter((e) => e !== null);
  return { elements, source: "geoapify" };
}

export async function fetchPlaceElements(lat, lon, radius) {
  const apiKey = process.env.GEOAPIFY_API_KEY;
  if (apiKey) {
    try {
      return await fetchFromGeoapify(lat, lon, radius, apiKey);
    } catch (err) {
      console.warn("[places] Geoapify başarısız, Overpass'a geçiliyor:", err);
    }
  }
  return fetchFromOverpass(lat, lon, radius);
}
