import { describe, expect, it, vi } from "vitest";

vi.mock("@/store/settings", () => ({ useSettingsStore: vi.fn() }));

const { dictionaries, translate } = await import("./index");

function keys(obj, prefix = "") {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === "object" && !Array.isArray(v) ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

describe("i18n", () => {
  it("TR ve EN sözlükleri aynı anahtarlara sahip olmalı", () => {
    expect(keys(dictionaries.en).sort()).toEqual(keys(dictionaries.tr).sort());
  });

  it("dizi değerleri aynı uzunlukta olmalı", () => {
    expect(dictionaries.en.prefs.priceLabels).toHaveLength(dictionaries.tr.prefs.priceLabels.length);
    expect(dictionaries.en.chat.suggestions).toHaveLength(dictionaries.tr.chat.suggestions.length);
  });

  it("değişkenleri metne yerleştirmeli", () => {
    expect(translate(dictionaries.tr, "place.walk", { minutes: 5 })).toBe("5 dk yürüme");
    expect(translate(dictionaries.en, "place.walk", { minutes: 5 })).toBe("5 min walk");
  });
});
