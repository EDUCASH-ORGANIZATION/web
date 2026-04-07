"use client"

import dynamic from "next/dynamic"

export const PwaInstallBannerLoader = dynamic(
  () => import("@/components/shared/pwa-install-banner").then((m) => m.PwaInstallBanner),
  { ssr: false }
)
