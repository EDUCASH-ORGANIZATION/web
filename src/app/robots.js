import { waitingModeEnabled } from "@/lib/site/waiting-mode"

export default function robots() {
  if (waitingModeEnabled()) {
    return { rules: [{ userAgent: "*", disallow: "/" }] }
  }
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin/", "/api/"],
      },
    ],
    sitemap: (process.env.NEXT_PUBLIC_APP_URL || "https://www.educash.bj") + "/sitemap.xml",
  }
}
