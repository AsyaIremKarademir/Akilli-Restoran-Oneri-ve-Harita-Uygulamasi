"use client";

import { useEffect, useState } from "react";

const memo = new Map();

/**
 * Mekanın OSM adresi yoksa, yalnızca kart açıldığında sunucudaki /api/geocode üzerinden adres bulur.
 * Sonuçlar oturum boyunca bellekte tutulur.
 */
export function useAddress(place, enabled, locale) {
  const key = `${place.id}|${locale}`;
  const [, rerender] = useState(0);
  const needsLookup = enabled && !place.address && !memo.has(key);

  useEffect(() => {
    if (!needsLookup) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ lat: String(place.lat), lon: String(place.lon), lang: locale });
    fetch(`/api/geocode?${params}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((d) => {
        memo.set(key, d.address);
        rerender((n) => n + 1);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        memo.set(key, null);
        rerender((n) => n + 1);
      });
    return () => controller.abort();
  }, [needsLookup, key, place.lat, place.lon, locale]);

  return {
    address: place.address ?? memo.get(key) ?? null,
    loading: needsLookup,
  };
}
