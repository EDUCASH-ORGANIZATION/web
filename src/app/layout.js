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
  title: "EduCash — Missions étudiantes",
  description: "Transforme tes compétences en revenu",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "EduCash",
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="fr" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
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
