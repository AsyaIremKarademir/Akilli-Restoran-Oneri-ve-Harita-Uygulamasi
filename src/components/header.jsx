"use client";

import { Check, Languages, LocateFixed, Monitor, Moon, SlidersHorizontal, Sun, UtensilsCrossed } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LOCALES, useT } from "@/i18n";
import { useLocationStore } from "@/store/location";
import { useSettingsStore } from "@/store/settings";
import { useUiStore } from "@/store/ui";

const LOCALE_LABELS = { tr: "Türkçe", en: "English" };

export function Header() {
  const { t, locale } = useT();
  const setLocale = useSettingsStore((s) => s.setLocale);
  const { theme, setTheme } = useTheme();
  const setPrefsOpen = useUiStore((s) => s.setPrefsOpen);
  const recenter = useUiStore((s) => s.recenter);
  const status = useLocationStore((s) => s.status);
  const retry = useLocationStore((s) => s.retry);

  const onLocate = () => {
    if (status !== "tracking") retry();
    recenter();
  };

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background/80 px-3 backdrop-blur md:px-4">
      <div className="flex items-center gap-2">
        <div className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
          <UtensilsCrossed className="size-5" />
        </div>
        <div className="leading-tight">
          <h1 className="text-base font-semibold">{t("app.name")}</h1>
          <p className="hidden text-xs text-muted-foreground sm:block">{t("app.tagline")}</p>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={onLocate}
          aria-label={t("header.locate")}
          title={t("header.locate")}
        >
          <LocateFixed />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={t("header.language")} title={t("header.language")}>
              <Languages />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {LOCALES.map((l) => (
              <DropdownMenuItem key={l} onClick={() => setLocale(l)}>
                {LOCALE_LABELS[l]}
                {l === locale && <Check className="ml-auto" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={t("header.theme")} title={t("header.theme")}>
              <Sun className="scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
              <Moon className="absolute scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {[
              ["light", Sun],
              ["dark", Moon],
              ["system", Monitor],
            ].map(([value, Icon]) => (
              <DropdownMenuItem key={value} onClick={() => setTheme(value)}>
                <Icon />
                {t(`header.${value}`)}
                {theme === value && <Check className="ml-auto" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button onClick={() => setPrefsOpen(true)} className="ml-1">
          <SlidersHorizontal />
          <span className="hidden sm:inline">{t("header.preferences")}</span>
        </Button>
      </div>
    </header>
  );
}
