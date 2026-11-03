"use client";

import { Loader2, MapPinned, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n";
import { useLocationStore } from "@/store/location";

export function LocationBanner() {
  const { t } = useT();
  const status = useLocationStore((s) => s.status);
  const retry = useLocationStore((s) => s.retry);

  if (status === "tracking") return null;

  if (status === "locating") {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-muted p-2.5 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> {t("location.locating")}
      </div>
    );
  }

  const message = status === "manual" ? `${t("location.manual")}. ${t("location.pickHint")}` : t(`location.${status}`);

  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-sm">
      <MapPinned className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
      <span className="flex-1">{message}</span>
      {status !== "unsupported" && (
        <Button size="sm" variant="ghost" className="-my-1 h-7 px-2" onClick={retry}>
          <Navigation /> {t("location.retry")}
        </Button>
      )}
    </div>
  );
}
