import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { haversineDistance } from "@/lib/geo";

/** Kullanıcı bu kadar hareket ederse mekanlar yeniden çekilir. */
const REFETCH_DISTANCE_M = 300;
/** Kayıtlı veri bu süreden eskiyse arka planda yenilenir. */
const STALE_AFTER_MS = 10 * 60 * 1000;

const covers = (a, origin, radius) => a.radius >= radius && haversineDistance(a.origin, origin) < REFETCH_DISTANCE_M;

/**
 * Çevredeki mekanlar. Son başarılı sonuç LocalStorage'da saklanır: sayfa yeniden açıldığında harita anında dolar,
 * veri kaynağı geçici olarak erişilemezse kullanıcı en son bilinen mekanları görmeye devam eder.
 */
export const usePlacesStore = create()(
  persist(
    (set, get) => ({
      places: [],
      status: "idle",
      fetchedAt: null,
      inflight: null,
      load: async (origin, radius, force = false) => {
        const { fetchedAt, inflight, status } = get();
        const fresh = fetchedAt && Date.now() - fetchedAt.at < STALE_AFTER_MS;
        if (!force && status !== "error" && fresh && covers(fetchedAt, origin, radius)) return;
        // Aynı bölge için zaten bir istek sürüyorsa onu iptal edip baştan başlamak yerine sonucunu bekle.
        if (!force && inflight && covers(inflight, origin, radius)) return;

        // Farklı bir konuma geçildiyse eski istek iptal edilir; yalnızca en güncel konumun sonucu kullanılır.
        inflight?.controller.abort();
        const controller = new AbortController();
        set({ status: "loading", inflight: { origin, radius, controller } });

        try {
          const params = new URLSearchParams({
            lat: origin.lat.toFixed(5),
            lon: origin.lon.toFixed(5),
            radius: String(radius),
          });
          const res = await fetch(`/api/places?${params}`, { signal: controller.signal });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          set({
            places: data.places,
            status: "success",
            fetchedAt: { origin, radius, at: Date.now() },
            inflight: null,
          });
        } catch (err) {
          if (err.name === "AbortError") return;
          // Hata durumunda mevcut (kayıtlı) mekanlar korunur; arayüz yalnızca uyarı gösterir.
          set({ status: "error", inflight: null });
        }
      },
    }),
    {
      name: "lezzet-radari:places",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ places: s.places, fetchedAt: s.fetchedAt }),
    },
  ),
);
