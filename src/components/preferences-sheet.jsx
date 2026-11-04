"use client";

import { RotateCcw, Trash2 } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useT } from "@/i18n";
import { CATEGORY_EMOJI, CUISINE_CATEGORIES } from "@/lib/cuisines";
import { formatDistance } from "@/lib/geo";
import { priceSymbols } from "@/lib/price";
import { PLACE_TYPES } from "@/lib/models";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/store/ui";
import { useUserStore } from "@/store/user";

const DISTANCE_STEPS = [250, 500, 750, 1000, 1500, 2000, 3000, 4000, 5000];

function Section({ title, hint, children }) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-medium">{title}</h3>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

export function PreferencesSheet() {
  const { t, dict, locale } = useT();
  const open = useUiStore((s) => s.prefsOpen);
  const setOpen = useUiStore((s) => s.setPrefsOpen);
  const setTab = useUiStore((s) => s.setTab);
  const prefs = useUserStore((s) => s.preferences);
  const setPrefs = useUserStore((s) => s.setPreferences);
  const reset = useUserStore((s) => s.resetPreferences);
  const clearVotes = useUserStore((s) => s.clearVotes);
  const hasVotes = useUserStore((s) => Object.keys(s.votes).length > 0);
  const onboarded = useUserStore((s) => s.onboarded);
  const completeOnboarding = useUserStore((s) => s.completeOnboarding);

  useEffect(() => {
    if (!onboarded) setOpen(true);
  }, [onboarded, setOpen]);

  const onOpenChange = (next) => {
    setOpen(next);
    if (!next && !onboarded) completeOnboarding();
  };

  const toggle = (list, item) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);
  const distanceIndex = Math.max(
    0,
    DISTANCE_STEPS.findIndex((d) => d >= prefs.maxDistance),
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle>{t("prefs.title")}</SheetTitle>
          <SheetDescription>{onboarded ? t("prefs.description") : t("prefs.welcome")}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-6 overflow-y-auto p-4">
          <Section title={t("prefs.cuisines")} hint={t("prefs.cuisinesHint")}>
            <div className="flex flex-wrap gap-2">
              {CUISINE_CATEGORIES.map((c) => {
                const active = prefs.cuisines.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setPrefs({ cuisines: toggle(prefs.cuisines, c) })}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors",
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "bg-background hover:bg-accent hover:text-accent-foreground",
                    )}
                  >
                    <span>{CATEGORY_EMOJI[c]}</span>
                    {t(`cuisine.${c}`)}
                  </button>
                );
              })}
            </div>
          </Section>

          <Separator />

          <Section title={t("prefs.distance")}>
            <div className="flex items-center gap-4">
              <Slider
                min={0}
                max={DISTANCE_STEPS.length - 1}
                step={1}
                value={[distanceIndex]}
                onValueChange={([i]) => setPrefs({ maxDistance: DISTANCE_STEPS[i] })}
                aria-label={t("prefs.distance")}
              />
              <span className="w-16 text-right text-sm font-medium tabular-nums">
                {formatDistance(prefs.maxDistance, locale)}
              </span>
            </div>
          </Section>

          <Section title={t("prefs.price")} hint={t("prefs.priceNote")}>
            <Slider
              min={1}
              max={4}
              step={1}
              minStepsBetweenThumbs={0}
              value={prefs.priceRange}
              onValueChange={(v) => setPrefs({ priceRange: [v[0], v[1]] })}
              aria-label={t("prefs.price")}
            />
            <div className="grid grid-cols-4 text-center text-xs">
              {dict.prefs.priceLabels.map((label, i) => {
                const level = i + 1;
                const inRange = level >= prefs.priceRange[0] && level <= prefs.priceRange[1];
                return (
                  <span key={label} className={inRange ? "font-medium" : "text-muted-foreground"}>
                    {priceSymbols(level)}
                    <br />
                    {label}
                  </span>
                );
              })}
            </div>
          </Section>

          <Separator />

          <Section title={t("prefs.types")}>
            <div className="grid grid-cols-3 gap-2">
              {PLACE_TYPES.map((type) => {
                const active = prefs.placeTypes.includes(type);
                return (
                  <Button
                    key={type}
                    type="button"
                    variant={active ? "default" : "outline"}
                    aria-pressed={active}
                    onClick={() =>
                      (!active || prefs.placeTypes.length > 1) &&
                      setPrefs({ placeTypes: toggle(prefs.placeTypes, type) })
                    }
                  >
                    {t(`types.${type}`)}
                  </Button>
                );
              })}
            </div>
          </Section>

          <Section title={t("prefs.dietary")}>
            {["vegetarian", "vegan", "wheelchair"].map((key) => (
              <div key={key} className="flex items-center justify-between">
                <Label htmlFor={`pref-${key}`} className="font-normal">
                  {t(`prefs.${key}`)}
                </Label>
                <Switch
                  id={`pref-${key}`}
                  checked={prefs[key]}
                  onCheckedChange={(checked) => setPrefs({ [key]: checked })}
                />
              </div>
            ))}
          </Section>

          <Separator />

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={reset}>
              <RotateCcw /> {t("prefs.reset")}
            </Button>
            {hasVotes && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  clearVotes();
                  toast(t("toast.votesCleared"));
                }}
              >
                <Trash2 /> {t("prefs.clearVotes")}
              </Button>
            )}
          </div>
        </div>

        <SheetFooter className="border-t">
          <Button
            onClick={() => {
              setTab("forYou");
              onOpenChange(false);
            }}
          >
            {t("prefs.done")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
