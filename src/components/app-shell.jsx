"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import { ChatWidget } from "@/components/chat/chat-widget";
import { Header } from "@/components/header";
import { PlacePanel } from "@/components/places/place-panel";
import { PreferencesSheet } from "@/components/preferences-sheet";
import { Toaster } from "@/components/ui/sonner";
import { useGeolocation } from "@/hooks/use-geolocation";
import { RecommendationsProvider } from "@/hooks/use-recommendations";
import { useT } from "@/i18n";

const MapView = dynamic(() => import("@/components/map/map-view"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-muted" />,
});

export default function AppShell() {
  const { t, locale } = useT();
  useGeolocation();

  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = `${t("app.name")} · ${t("app.tagline")}`;
  }, [locale, t]);

  return (
    <RecommendationsProvider>
      <div className="flex h-dvh flex-col">
        <Header />
        <main className="flex min-h-0 flex-1 flex-col md:flex-row">
          <div className="relative isolate h-[42dvh] shrink-0 md:order-2 md:h-auto md:flex-1">
            <MapView />
          </div>
          <aside className="flex min-h-0 flex-1 flex-col border-t md:order-1 md:w-[420px] md:flex-none md:border-t-0 md:border-r">
            <PlacePanel />
          </aside>
        </main>
      </div>
      <PreferencesSheet />
      <ChatWidget />
      <Toaster position="top-center" richColors />
    </RecommendationsProvider>
  );
}
