"use client"

import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter"
import { ThemeProvider } from "@mui/material/styles"
import ScopedCssBaseline from "@mui/material/ScopedCssBaseline"
import theme from "./theme"

/**
 * Fournit le thème Material UI uniquement pour le site vitrine.
 * `ScopedCssBaseline` confine le reset CSS de MUI à l'arbre de la vitrine,
 * afin de ne pas entrer en conflit avec Tailwind utilisé dans l'app.
 */
export function VitrineProvider({ children }) {
  return (
    <AppRouterCacheProvider options={{ key: "mui" }}>
      <ThemeProvider theme={theme}>
        <ScopedCssBaseline>{children}</ScopedCssBaseline>
      </ThemeProvider>
    </AppRouterCacheProvider>
  )
}
