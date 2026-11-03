import { create } from "zustand";

export const useUiStore = create()((set) => ({
  selectedId: null,
  selectionSource: null,
  tab: "forYou",
  prefsOpen: false,
  chatOpen: false,
  recenterKey: 0,
  select: (selectedId, selectionSource = "list") => set({ selectedId, selectionSource }),
  recenter: () => set((s) => ({ recenterKey: s.recenterKey + 1 })),
  setTab: (tab) => set({ tab }),
  setPrefsOpen: (prefsOpen) => set({ prefsOpen }),
  setChatOpen: (chatOpen) => set({ chatOpen }),
}));
