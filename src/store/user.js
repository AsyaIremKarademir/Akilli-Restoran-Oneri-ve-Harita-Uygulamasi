import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { PLACE_TYPES } from "@/lib/models";

export const DEFAULT_PREFERENCES = {
  cuisines: [],
  maxDistance: 1500,
  priceRange: [1, 3],
  placeTypes: [...PLACE_TYPES],
  vegetarian: false,
  vegan: false,
  wheelchair: false,
};

/**
 * Kullanıcının tercihleri ve oy geçmişi. `persist` ara katmanı sayesinde LocalStorage'da saklanır;
 * şema değişirse `version` artırılıp `migrate` ile eski veri dönüştürülür.
 */
export const useUserStore = create()(
  persist(
    (set, get) => ({
      preferences: DEFAULT_PREFERENCES,
      votes: {},
      onboarded: false,
      setPreferences: (patch) => set((s) => ({ preferences: { ...s.preferences, ...patch } })),
      resetPreferences: () => set({ preferences: DEFAULT_PREFERENCES }),
      vote: (place, vote) => {
        const votes = { ...get().votes };
        const current = votes[place.id]?.vote;
        if (current === vote) {
          delete votes[place.id];
          set({ votes });
          return null;
        }
        votes[place.id] = { vote, place, at: Date.now() };
        set({ votes });
        return vote;
      },
      clearVotes: () => set({ votes: {} }),
      completeOnboarding: () => set({ onboarded: true }),
    }),
    {
      name: "lezzet-radari:user",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      migrate: (persisted) => {
        const state = persisted;
        return {
          ...state,
          preferences: { ...DEFAULT_PREFERENCES, ...state.preferences },
        };
      },
    },
  ),
);
