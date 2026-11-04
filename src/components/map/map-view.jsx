"use client";

import L from "leaflet";
import { useEffect, useMemo, useRef } from "react";
import { Circle, MapContainer, Marker, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import { useOrigin, useRecommendations } from "@/hooks/use-recommendations";
import { useT } from "@/i18n";
import { CATEGORY_EMOJI } from "@/lib/cuisines";
import { formatDistance } from "@/lib/geo";

import { useLocationStore } from "@/store/location";
import { useUiStore } from "@/store/ui";
import { useUserStore } from "@/store/user";

const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

const iconCache = new Map();
function placeIcon(place, rank, selected, dimmed) {
  const emoji = CATEGORY_EMOJI[place.categories[0] ?? "other"];
  const key = `${emoji}|${rank ?? ""}|${selected}|${dimmed}`;
  let icon = iconCache.get(key);
  if (!icon) {
    const classes = ["place-pin", rank ? "is-ranked" : "", selected ? "is-selected" : "", dimmed ? "is-dimmed" : ""];
    icon = L.divIcon({
      className: "",
      html: `<div class="${classes.join(" ")}"><span>${emoji}</span>${rank ? `<b>${rank}</b>` : ""}</div>`,
      iconSize: [36, 36],
      iconAnchor: [18, 36],
      tooltipAnchor: [0, -34],
    });
    iconCache.set(key, icon);
  }
  return icon;
}

const userIcon = L.divIcon({
  className: "",
  html: '<div class="user-pin"><span></span></div>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

function MapController() {
  const map = useMap();
  const origin = useOrigin();
  const status = useLocationStore((s) => s.status);
  const selectedId = useUiStore((s) => s.selectedId);
  const source = useUiStore((s) => s.selectionSource);
  const recenterKey = useUiStore((s) => s.recenterKey);
  const { nearby: places } = useRecommendations();
  const centeredOnce = useRef(false);

  useEffect(() => {
    if (status === "tracking" && !centeredOnce.current) {
      centeredOnce.current = true;
      map.flyTo([origin.lat, origin.lon], 15, { duration: 1 });
    }
  }, [status, origin, map]);

  useEffect(() => {
    if (recenterKey > 0) map.flyTo([origin.lat, origin.lon], 15, { duration: 0.8 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recenterKey, map]);

  useEffect(() => {
    if (!selectedId || source !== "list") return;
    const target = places.find((p) => p.place.id === selectedId)?.place;
    if (target) map.flyTo([target.lat, target.lon], Math.max(map.getZoom(), 17), { duration: 0.8 });
  }, [selectedId, source, places, map]);

  return null;
}

function LocationPicker() {
  const status = useLocationStore((s) => s.status);
  const setManual = useLocationStore((s) => s.setManual);
  const select = useUiStore((s) => s.select);
  useMapEvents({
    click(e) {
      if (status === "tracking") {
        select(null);
        return;
      }
      setManual({ lat: e.latlng.lat, lon: e.latlng.lng });
    },
    contextmenu(e) {
      setManual({ lat: e.latlng.lat, lon: e.latlng.lng });
    },
  });
  return null;
}

export default function MapView() {
  const { t, locale } = useT();
  const origin = useOrigin();
  const accuracy = useLocationStore((s) => s.accuracy);
  const maxDistance = useUserStore((s) => s.preferences.maxDistance);
  const { recommendations, nearby } = useRecommendations();
  const selectedId = useUiStore((s) => s.selectedId);
  const select = useUiStore((s) => s.select);

  const ranks = useMemo(() => {
    const m = new Map();
    recommendations.slice(0, 10).forEach((r, i) => m.set(r.place.id, i + 1));
    return m;
  }, [recommendations]);
  const recommendedIds = useMemo(() => new Set(recommendations.map((r) => r.place.id)), [recommendations]);

  return (
    <MapContainer
      center={[origin.lat, origin.lon]}
      zoom={15}
      className="h-full w-full"
      zoomControl={false}
      attributionControl
    >
      <TileLayer url={TILE_URL} attribution={ATTRIBUTION} maxZoom={19} className="map-tiles" />
      <MapController />
      <LocationPicker />

      <Circle
        center={[origin.lat, origin.lon]}
        radius={maxDistance}
        pathOptions={{ className: "radius-circle", weight: 1.5, dashArray: "6 6", fillOpacity: 0.04 }}
      />
      {accuracy && accuracy < maxDistance && (
        <Circle
          center={[origin.lat, origin.lon]}
          radius={accuracy}
          pathOptions={{ className: "accuracy-circle", weight: 0, fillOpacity: 0.15 }}
        />
      )}
      <Marker position={[origin.lat, origin.lon]} icon={userIcon} zIndexOffset={1000}>
        <Tooltip>
          {t("location.you")}
          {accuracy ? ` · ${t("location.accuracy", { meters: Math.round(accuracy) })}` : ""}
        </Tooltip>
      </Marker>

      {nearby.map(({ place, distance }) => {
        const rank = ranks.get(place.id);
        const selected = place.id === selectedId;
        return (
          <Marker
            key={place.id}
            position={[place.lat, place.lon]}
            icon={placeIcon(place, rank, selected, !recommendedIds.has(place.id))}
            zIndexOffset={selected ? 900 : rank ? 500 - rank : 0}
            eventHandlers={{ click: () => select(place.id, "map") }}
          >
            <Tooltip direction="top">
              <strong>{place.name}</strong>
              <br />
              {t(`types.${place.type}`)} · {formatDistance(distance, locale)}
            </Tooltip>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
