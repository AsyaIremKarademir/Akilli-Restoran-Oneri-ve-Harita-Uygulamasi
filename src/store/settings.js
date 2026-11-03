import { create } from "zustand";
import { persist } from "zustand/middleware";

export const useSettingsStore = create()(
  persist(
    (set) => ({
      locale: "tr",
      setLocale: (locale) => set({ locale }),
    }),
    { name: "lezzet-radari:settings" },
  ),
);
