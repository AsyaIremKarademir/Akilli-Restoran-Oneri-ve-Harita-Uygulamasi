import { create } from "zustand";

/** Konum alınamazsa kullanılan varsayılan merkez: Kızılay, Ankara */
export const DEFAULT_CENTER = { lat: 39.9208, lon: 32.8541 };

export const useLocationStore = create()((set) => ({
  position: null,
  accuracy: null,
  status: "locating",
  watchKey: 0,
  // Kullanıcı haritadan elle konum seçtiyse GPS güncellemeleri onu ezmez.
  setGps: (position, accuracy) => set((s) => (s.status === "manual" ? s : { position, accuracy, status: "tracking" })),
  setError: (status) => set((s) => (s.status === "manual" ? s : { status })),
  setManual: (position) => set({ position, accuracy: null, status: "manual" }),
  retry: () => set((s) => ({ status: "locating", watchKey: s.watchKey + 1 })),
}));
