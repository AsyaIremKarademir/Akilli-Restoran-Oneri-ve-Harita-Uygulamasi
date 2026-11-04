"use client";

import dynamic from "next/dynamic";

export const ClientApp = dynamic(() => import("@/components/app-shell"), {
  ssr: false,
  loading: () => (
    <div className="grid h-dvh place-items-center">
      <div className="size-10 animate-spin rounded-full border-4 border-muted border-t-primary" />
    </div>
  ),
});
