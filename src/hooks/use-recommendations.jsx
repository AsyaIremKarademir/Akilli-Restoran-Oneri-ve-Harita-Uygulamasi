"use client";

import { createContext, useContext, useEffect, useMemo } from "react";
import { haversineDistance } from "@/lib/geo";
import { rankPlaces } from "@/lib/scoring";

import { DEFAULT_CENTER, useLocationStore } from "@/store/location";
import { usePlacesStore } from "@/store/places";
import { useUserStore } from "@/store/user";

export function useOrigin() {
  const position = useLocationStore((s) => s.position);
  return position ?? DEFAULT_CENTER;
}

export function usePlacesLoader() {
  const origin = useOrigin();
  const status = useLocationStore((s) => s.status);
  const maxDistance = useUserStore((s) => s.preferences.maxDistance);
  const load = usePlacesStore((s) => s.load);

  useEffect(() => {
    if (status === "locating") return;
    const timer = setTimeout(() => void load(origin, maxDistance), 400);
    return () => clearTimeout(timer);
  }, [origin, maxDistance, status, load]);
}

const RecommendationsContext = createContext(null);

export function RecommendationsProvider({ children }) {
  usePlacesLoader();
  const origin = useOrigin();
  const places = usePlacesStore((s) => s.places);
  const preferences = useUserStore((s) => s.preferences);
  const votes = useUserStore((s) => s.votes);

  const value = useMemo(() => {
    const recommendations = rankPlaces(places, origin, preferences, votes);
    const nearby = places
      .map((place) => ({ place, distance: haversineDistance(origin, place) }))
      .filter((p) => p.distance <= preferences.maxDistance)
      .sort((a, b) => a.distance - b.distance);
    return {
      recommendations,
      nearby,
      byId: new Map(recommendations.map((r) => [r.place.id, r])),
      origin,
    };
  }, [places, origin, preferences, votes]);

  return <RecommendationsContext.Provider value={value}>{children}</RecommendationsContext.Provider>;
}

export function useRecommendations() {
  const ctx = useContext(RecommendationsContext);
  if (!ctx) throw new Error("useRecommendations, RecommendationsProvider içinde kullanılmalı");
  return ctx;
}
