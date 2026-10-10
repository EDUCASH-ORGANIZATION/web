import "./globals.css"
import { Anton, Figtree, Inter } from "next/font/google"
import { SupabaseProvider } from "@/components/shared/supabase-provider"
import { Toaster } from "@/components/shared/toaster"
import { PwaInstallBannerLoader } from "@/components/shared/pwa-install-banner-loader"
import { RouteScroll } from "@/components/shared/route-scroll"

const anton = Anton({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  variable: "--font-anton",
})

const figtree = Figtree({
  weight: ["400", "500", "600", "700", "800", "900"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-figtree",
})

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
})

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#2F3BED",
}

export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://www.educash.bj"),
  title: {
    default: "EduCash",
    template: "%s - EduCash",
  },
  description:
    "Confiez vos petites missions à des étudiants vérifiés au Bénin : marché, devoirs, garde d'enfants, démarches. Votre argent reste bloqué jusqu'à votre validation.",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-48.png", sizes: "48x48", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "EduCash",
  },
  openGraph: {
    siteName: "EduCash",
    locale: "fr_BJ",
    type: "website",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="fr" className={`${anton.variable} ${figtree.variable} ${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body className="min-h-full flex flex-col font-[family-name:var(--font-inter)]" suppressHydrationWarning>
        <SupabaseProvider>
          <Toaster>
            <RouteScroll />
            {children}
            <PwaInstallBannerLoader />
          </Toaster>
        </SupabaseProvider>
      </body>
    </html>
  )
}
