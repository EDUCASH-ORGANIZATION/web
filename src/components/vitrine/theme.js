import { createTheme } from "@mui/material/styles"

// ─── Palette de marque EduCash ───────────────────────────────────────────────
export const BRAND = {
  green:       "#1A6B4A",
  greenDark:   "#0F5037",
  greenDarker: "#0A3A28",
  greenLight:  "#2E9B6B",
  greenSoft:   "#EAF7F0",
  amber:       "#F59E0B",
  amberDark:   "#D97706",
  amberLight:  "#FBBF24",
  amberSoft:   "#FEF6E7",
  navy:        "#0E1426",
  navy2:       "#1A1A2E",
  violet:      "#7C3AED",
  sky:         "#0EA5E9",
  ink:         "#0F172A",
  slate:       "#64748B",
}

// Dégradés réutilisables
export const GRADIENTS = {
  brand:    `linear-gradient(135deg, ${BRAND.green} 0%, ${BRAND.greenLight} 100%)`,
  amber:    `linear-gradient(135deg, ${BRAND.amber} 0%, ${BRAND.amberLight} 100%)`,
  hero:     `radial-gradient(120% 120% at 0% 0%, ${BRAND.greenSoft} 0%, #FFFFFF 45%, ${BRAND.amberSoft} 100%)`,
  dark:     `linear-gradient(160deg, ${BRAND.navy} 0%, ${BRAND.navy2} 100%)`,
  text:     `linear-gradient(135deg, ${BRAND.green} 0%, ${BRAND.amber} 120%)`,
}

const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main:         BRAND.green,
      light:        BRAND.greenLight,
      dark:         BRAND.greenDark,
      contrastText: "#FFFFFF",
    },
    secondary: {
      main:         BRAND.amber,
      light:        BRAND.amberLight,
      dark:         BRAND.amberDark,
      contrastText: "#3A2A06",
    },
    success: { main: BRAND.greenLight },
    info:    { main: BRAND.sky },
    background: { default: "#FFFFFF", paper: "#FFFFFF" },
    text:    { primary: BRAND.ink, secondary: BRAND.slate },
    divider: "rgba(15,23,42,0.08)",
  },

  shape: { borderRadius: 16 },

  typography: {
    fontFamily: "var(--font-inter), system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    h1: { fontWeight: 800, letterSpacing: "-0.025em", lineHeight: 1.05 },
    h2: { fontWeight: 800, letterSpacing: "-0.02em",  lineHeight: 1.12 },
    h3: { fontWeight: 800, letterSpacing: "-0.02em",  lineHeight: 1.15 },
    h4: { fontWeight: 700, letterSpacing: "-0.01em" },
    h5: { fontWeight: 700 },
    h6: { fontWeight: 700 },
    subtitle1: { fontWeight: 600 },
    button: { fontWeight: 700, textTransform: "none", letterSpacing: 0 },
    overline: { fontWeight: 700, letterSpacing: "0.14em" },
  },

  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          borderRadius: 12,
          paddingInline: 22,
          paddingBlock: 11,
          fontSize: "0.9rem",
          transition: "transform .18s ease, box-shadow .18s ease, background .18s ease",
          "&:hover": { transform: "translateY(-2px)" },
        },
        containedPrimary: {
          background: GRADIENTS.brand,
          boxShadow: "0 12px 28px -10px rgba(26,107,74,0.55)",
          "&:hover": { boxShadow: "0 18px 34px -10px rgba(26,107,74,0.6)" },
        },
        containedSecondary: {
          background: GRADIENTS.amber,
          color: "#3A2A06",
          boxShadow: "0 12px 28px -10px rgba(245,158,11,0.5)",
        },
        sizeLarge: { paddingInline: 30, paddingBlock: 14, fontSize: "1rem", borderRadius: 14 },
        outlinedPrimary: { borderWidth: 2, "&:hover": { borderWidth: 2 } },
      },
    },
    MuiPaper: {
      styleOverrides: { rounded: { borderRadius: 20 } },
    },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          borderRadius: 22,
          border: "1px solid rgba(15,23,42,0.07)",
          backgroundImage: "none",
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 600, borderRadius: 999 },
      },
    },
    MuiContainer: {
      defaultProps: { maxWidth: "lg" },
    },
    MuiCssBaseline: {
      styleOverrides: {
        "::selection": { background: "rgba(26,107,74,0.2)" },
      },
    },
  },
})

export default theme
