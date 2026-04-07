import { Inter } from "next/font/google"
import "./globals.css"
import { SupabaseProvider } from "@/components/shared/supabase-provider"
import { Toaster } from "@/components/shared/toaster"
import { PwaInstallBannerLoader } from "@/components/shared/pwa-install-banner-loader"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
})

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#1A6B4A",
}

export const metadata = {
  title: {
    default: "EduCash",
    template: "%s — EduCash",
  },
  description: "Missions ponctuelles rémunérées pour les étudiants au Bénin",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "EduCash",
  },
  openGraph: {
    siteName: "EduCash",
    locale: "fr_BJ",
    type: "website",
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="fr" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body className="min-h-full flex flex-col font-[family-name:var(--font-inter)]" suppressHydrationWarning>
        <SupabaseProvider>
          <Toaster>
            {children}
            <PwaInstallBannerLoader />
          </Toaster>
        </SupabaseProvider>
      </body>
    </html>
  )
}
