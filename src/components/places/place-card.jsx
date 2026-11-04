"use client";

import {
  Accessibility,
  Clock,
  ExternalLink,
  Footprints,
  Leaf,
  MapPin,
  Navigation,
  Phone,
  ShoppingBag,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Trees,
  Truck,
} from "lucide-react";
import { memo, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAddress } from "@/hooks/use-address";
import { useT } from "@/i18n";
import { CATEGORY_EMOJI } from "@/lib/cuisines";
import { formatDistance, walkingMinutes } from "@/lib/geo";
import { priceSymbols } from "@/lib/price";
import { WEIGHTS } from "@/lib/scoring";

import { cn } from "@/lib/utils";
import { useUiStore } from "@/store/ui";
import { useUserStore } from "@/store/user";
import { ScoreRing } from "./score-ring";

function useReasonText() {
  const { t, locale } = useT();
  return (r) => {
    switch (r.kind) {
      case "cuisine":
      case "similar":
        return t(`reason.${r.kind}`, { cuisine: t(`cuisine.${r.category}`) });
      case "near":
        return t("reason.near", { distance: formatDistance(r.meters, locale) });
      default:
        return t(`reason.${r.kind}`);
    }
  };
}

function PlaceCardImpl({ place, distance, scored, rank }) {
  const { t, dict, locale } = useT();
  const reasonText = useReasonText();
  const selected = useUiStore((s) => s.selectedId === place.id);
  const selectionSource = useUiStore((s) => s.selectionSource);
  const select = useUiStore((s) => s.select);
  const myVote = useUserStore((s) => s.votes[place.id]?.vote);
  const vote = useUserStore((s) => s.vote);
  const { address, loading: addressLoading } = useAddress(place, selected, locale);
  const ref = useRef(null);

  useEffect(() => {
    if (selected && selectionSource === "map") ref.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selected, selectionSource]);

  const onVote = (v) => {
    const result = vote(place, v);
    if (result === 1) toast.success(t("toast.liked", { name: place.name }));
    else if (result === -1) toast(t("toast.disliked", { name: place.name }));
    else toast(t("toast.removed"));
  };

  const features = [
    [place.vegan, Leaf, "place.vegan"],
    [place.vegetarian && !place.vegan, Leaf, "place.vegetarian"],
    [place.wheelchair, Accessibility, "place.wheelchair"],
    [place.outdoorSeating, Trees, "place.outdoor"],
    [place.takeaway, ShoppingBag, "place.takeaway"],
    [place.delivery, Truck, "place.delivery"],
  ];

  return (
    <div
      ref={ref}
      role="button"
      tabIndex={0}
      aria-expanded={selected}
      onClick={() => select(selected ? null : place.id, "list")}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          select(selected ? null : place.id, "list");
        }
      }}
      className={cn(
        "group cursor-pointer rounded-xl border bg-card p-3 text-card-foreground transition-all outline-none hover:border-primary/40 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring",
        selected && "border-primary/60 shadow-md ring-1 ring-primary/30",
        myVote === -1 && "opacity-60",
      )}
    >
      <div className="flex items-start gap-3">
        <div className="relative grid size-11 shrink-0 place-items-center rounded-lg bg-muted text-xl">
          {CATEGORY_EMOJI[place.categories[0] ?? "other"]}
          {rank && (
            <span className="absolute -top-1.5 -left-1.5 grid size-5 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
              {rank}
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="truncate font-medium">{place.name}</h3>
            {myVote === 1 && <ThumbsUp className="size-3.5 shrink-0 fill-primary text-primary" />}
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {t(`types.${place.type}`)} · {place.categories.map((c) => t(`cuisine.${c}`)).join(", ")}
          </p>
          <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Footprints className="size-3.5" />
              {formatDistance(distance, locale)} · {t("place.walk", { minutes: walkingMinutes(distance) })}
            </span>
            <span
              className="font-medium text-foreground/80"
              title={place.priceEstimated ? t("place.estimatedPrice") : t("place.price")}
            >
              {priceSymbols(place.priceLevel)}
              {place.priceEstimated && <span className="text-muted-foreground">*</span>}
            </span>
          </div>
        </div>

        {scored && <ScoreRing score={scored.score} />}
      </div>

      {scored && scored.reasons.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {scored.reasons.slice(0, selected ? undefined : 2).map((r) => (
            <Badge key={r.kind} variant="secondary" className="font-normal">
              {reasonText(r)}
            </Badge>
          ))}
        </div>
      )}

      {selected && (
        <div className="mt-3 space-y-3 border-t pt-3 text-sm" onClick={(e) => e.stopPropagation()}>
          <div className="space-y-1.5 text-muted-foreground">
            <p className="flex gap-2">
              <MapPin className="mt-0.5 size-4 shrink-0" />
              <span>{address ?? (addressLoading ? t("place.findingAddress") : t("place.noAddress"))}</span>
            </p>
            {place.openingHours && (
              <p className="flex gap-2">
                <Clock className="mt-0.5 size-4 shrink-0" />
                <span className="break-words">{place.openingHours}</span>
              </p>
            )}
            {place.phone && (
              <p className="flex gap-2">
                <Phone className="mt-0.5 size-4 shrink-0" />
                <a href={`tel:${place.phone}`} className="hover:underline">
                  {place.phone}
                </a>
              </p>
            )}
          </div>

          {features.some(([on]) => on) && (
            <div className="flex flex-wrap gap-1">
              {features
                .filter(([on]) => on)
                .map(([, Icon, key]) => (
                  <Badge key={key} variant="outline" className="font-normal">
                    <Icon /> {t(key)}
                  </Badge>
                ))}
            </div>
          )}

          {scored && (
            <div>
              <p className="mb-1.5 flex items-center gap-1 text-xs font-medium">
                <Sparkles className="size-3.5 text-primary" /> {t("place.whyTitle")}
              </p>
              <div className="grid grid-cols-[auto_1fr_auto] items-center gap-x-2 gap-y-1 text-xs">
                {Object.keys(WEIGHTS).map((k) => (
                  <BreakdownRow key={k} label={dict.breakdown[k]} value={scored.breakdown[k]} weight={WEIGHTS[k]} />
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant={myVote === 1 ? "default" : "outline"}
              onClick={() => onVote(1)}
              aria-pressed={myVote === 1}
            >
              <ThumbsUp /> {t("place.like")}
            </Button>
            <Button
              size="sm"
              variant={myVote === -1 ? "destructive" : "outline"}
              onClick={() => onVote(-1)}
              aria-pressed={myVote === -1}
            >
              <ThumbsDown /> {t("place.dislike")}
            </Button>
            <div className="ml-auto flex gap-1">
              {place.website && (
                <Button size="icon" variant="ghost" asChild title={t("place.website")}>
                  <a href={place.website} target="_blank" rel="noopener noreferrer">
                    <ExternalLink />
                  </a>
                </Button>
              )}
              <Button size="sm" variant="secondary" asChild>
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lon}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Navigation /> {t("place.directions")}
                </a>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BreakdownRow({ label, value, weight }) {
  return (
    <>
      <span className="text-muted-foreground">{label}</span>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${value * 100}%` }} />
      </div>
      <span className="w-14 text-right tabular-nums text-muted-foreground">
        +{Math.round(value * weight * 100)}/{Math.round(weight * 100)}
      </span>
    </>
  );
}

export const PlaceCard = memo(PlaceCardImpl);
