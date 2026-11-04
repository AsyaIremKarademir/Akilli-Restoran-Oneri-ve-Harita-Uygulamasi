"use client";

import { AlertCircle, RefreshCw, Search, SearchX, ThumbsUp } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRecommendations } from "@/hooks/use-recommendations";
import { useT } from "@/i18n";
import { formatDistance, haversineDistance } from "@/lib/geo";
import { useLocationStore } from "@/store/location";
import { usePlacesStore } from "@/store/places";
import { useUiStore } from "@/store/ui";
import { useUserStore } from "@/store/user";
import { LocationBanner } from "./location-banner";
import { PlaceCard } from "./place-card";

const PAGE = 40;

function EmptyState({ icon: Icon, title, hint }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <Icon className="size-10 text-muted-foreground/60" />
      <p className="font-medium">{title}</p>
      {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
    </div>
  );
}

function LoadingList() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} className="h-[76px] rounded-xl" />
      ))}
    </div>
  );
}

export function PlacePanel() {
  const { t, locale } = useT();
  const { recommendations, nearby, byId, origin } = useRecommendations();
  const status = usePlacesStore((s) => s.status);
  const load = usePlacesStore((s) => s.load);
  const locationStatus = useLocationStore((s) => s.status);
  const maxDistance = useUserStore((s) => s.preferences.maxDistance);
  const votes = useUserStore((s) => s.votes);
  const tab = useUiStore((s) => s.tab);
  const setTab = useUiStore((s) => s.setTab);
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE);

  const filteredNearby = useMemo(() => {
    const q = query.trim().toLocaleLowerCase(locale);
    if (!q) return nearby;
    return nearby.filter(({ place }) =>
      [place.name, ...place.cuisines, ...place.categories.map((c) => t(`cuisine.${c}`))].some((s) =>
        s.toLocaleLowerCase(locale).includes(q),
      ),
    );
  }, [nearby, query, locale, t]);

  const saved = useMemo(
    () =>
      Object.values(votes)
        .sort((a, b) => b.at - a.at)
        .map((v) => ({ ...v, distance: haversineDistance(origin, v.place) })),
    [votes, origin],
  );

  const initialLoading = (status === "loading" && nearby.length === 0) || locationStatus === "locating";
  const errorBox = status === "error" && (
    <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
      <AlertCircle className="size-4 shrink-0 text-destructive" />
      <span className="flex-1">{nearby.length ? t("list.showingCached") : t("list.error")}</span>
      <Button size="sm" variant="outline" onClick={() => void load(origin, maxDistance, true)}>
        {t("list.retry")}
      </Button>
    </div>
  );

  return (
    <Tabs
      value={tab}
      onValueChange={(v) => {
        setTab(v);
        setLimit(PAGE);
      }}
      className="flex h-full min-h-0 flex-col gap-0"
    >
      <div className="space-y-3 border-b p-3">
        <LocationBanner />
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="forYou">{t("tabs.forYou")}</TabsTrigger>
          <TabsTrigger value="all">
            {t("tabs.all")} <span className="text-muted-foreground tabular-nums">{nearby.length}</span>
          </TabsTrigger>
          <TabsTrigger value="saved">
            {t("tabs.saved")} <span className="text-muted-foreground tabular-nums">{saved.length}</span>
          </TabsTrigger>
        </TabsList>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <TabsContent value="forYou" className="mt-0 space-y-2">
          <div className="flex items-end justify-between gap-2 pb-1">
            <div>
              <h2 className="font-semibold">{t("list.forYouTitle")}</h2>
              <p className="text-xs text-muted-foreground">
                {t("list.forYouSubtitle", { count: recommendations.length })} · {t("list.sortedBy")}
              </p>
            </div>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => void load(origin, maxDistance, true)}
              disabled={status === "loading"}
              aria-label={t("list.refresh")}
              title={t("list.refresh")}
            >
              <RefreshCw className={status === "loading" ? "animate-spin" : ""} />
            </Button>
          </div>
          {errorBox}
          {initialLoading ? (
            <LoadingList />
          ) : recommendations.length === 0 && status !== "error" ? (
            <EmptyState icon={SearchX} title={t("list.empty")} hint={t("list.emptyHint")} />
          ) : (
            recommendations
              .slice(0, limit)
              .map((r, i) => (
                <PlaceCard
                  key={r.place.id}
                  place={r.place}
                  distance={r.distance}
                  scored={r}
                  rank={i < 10 ? i + 1 : undefined}
                />
              ))
          )}
          {recommendations.length > limit && (
            <Button variant="ghost" className="w-full" onClick={() => setLimit((l) => l + PAGE)}>
              +{recommendations.length - limit}
            </Button>
          )}
        </TabsContent>

        <TabsContent value="all" className="mt-0 space-y-2">
          <div className="relative pb-1">
            <Search className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setLimit(PAGE);
              }}
              placeholder={t("list.search")}
              className="pl-8"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {t("list.allSubtitle", { count: filteredNearby.length, radius: formatDistance(maxDistance, locale) })}
          </p>
          {errorBox}
          {initialLoading ? (
            <LoadingList />
          ) : filteredNearby.length === 0 && status !== "error" ? (
            <EmptyState icon={SearchX} title={t("list.empty")} hint={t("list.emptyHint")} />
          ) : (
            filteredNearby
              .slice(0, limit)
              .map(({ place, distance }) => (
                <PlaceCard key={place.id} place={place} distance={distance} scored={byId.get(place.id)} />
              ))
          )}
          {filteredNearby.length > limit && (
            <Button variant="ghost" className="w-full" onClick={() => setLimit((l) => l + PAGE)}>
              +{filteredNearby.length - limit}
            </Button>
          )}
        </TabsContent>

        <TabsContent value="saved" className="mt-0 space-y-2">
          {saved.length === 0 ? (
            <EmptyState icon={ThumbsUp} title={t("list.noSaved")} hint={t("list.noSavedHint")} />
          ) : (
            saved.map((v) => (
              <PlaceCard key={v.place.id} place={v.place} distance={v.distance} scored={byId.get(v.place.id)} />
            ))
          )}
        </TabsContent>
      </div>
    </Tabs>
  );
}
