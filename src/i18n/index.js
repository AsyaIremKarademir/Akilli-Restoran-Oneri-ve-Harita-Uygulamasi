"use client";

import { useCallback } from "react";
import { useSettingsStore } from "@/store/settings";
import en from "./en";
import tr from "./tr";

export const LOCALES = ["tr", "en"];
export const dictionaries = { tr, en };

export function translate(dict, key, vars) {
  const value = key.split(".").reduce((obj, k) => obj?.[k], dict);
  if (typeof value !== "string") return key;
  return vars ? value.replace(/\{(\w+)\}/g, (_, v) => String(vars[v] ?? `{${v}}`)) : value;
}

export function useT() {
  const locale = useSettingsStore((s) => s.locale);
  const dict = dictionaries[locale];
  const t = useCallback((key, vars) => translate(dict, key, vars), [dict]);
  return { t, dict, locale };
}
