"use client";

import { useEffect } from "react";
import { useLocationStore } from "@/store/location";

export function useGeolocation() {
  const watchKey = useLocationStore((s) => s.watchKey);

  useEffect(() => {
    const { setGps, setError } = useLocationStore.getState();
    if (!("geolocation" in navigator)) {
      setError("unsupported");
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (pos) => setGps({ lat: pos.coords.latitude, lon: pos.coords.longitude }, pos.coords.accuracy),
      (err) => setError(err.code === err.PERMISSION_DENIED ? "denied" : "unavailable"),
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 15_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [watchKey]);
}
