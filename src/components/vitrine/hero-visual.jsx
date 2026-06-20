"use client"

import { Component, useEffect, useState } from "react"
import dynamic from "next/dynamic"
import Box from "@mui/material/Box"
import { Stack } from "./stack"
import Typography from "@mui/material/Typography"
import SavingsRoundedIcon from "@mui/icons-material/SavingsRounded"
import VerifiedRoundedIcon from "@mui/icons-material/VerifiedRounded"
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded"
import BoltRoundedIcon from "@mui/icons-material/BoltRounded"
import { keyframes } from "@mui/system"
import { BRAND, GRADIENTS } from "./theme"

const float = keyframes`
  0%, 100% { transform: translateY(0) }
  50% { transform: translateY(-14px) }
`
const floatSlow = keyframes`
  0%, 100% { transform: translateY(0) rotate(0deg) }
  50% { transform: translateY(-10px) rotate(6deg) }
`
const spinSlow = keyframes`
  from { transform: rotate(0deg) } to { transform: rotate(360deg) }
`

function FloatingCard({ children, sx, delay = 0 }) {
  return (
    <Box sx={{
      position: "absolute", zIndex: 2, bgcolor: "rgba(255,255,255,0.85)",
      backdropFilter: "blur(8px)", borderRadius: 3, px: 1.8, py: 1.2,
      boxShadow: "0 18px 40px -18px rgba(15,23,42,0.4)", border: "1px solid rgba(255,255,255,0.6)",
      animation: `${float} 5s ease-in-out ${delay}s infinite`, ...sx,
    }}>
      {children}
    </Box>
  )
}

/** Visuel statique élégant — affiché si WebGL indisponible ou pendant le chargement de la 3D. */
export function HeroFallback() {
  return (
    <Box sx={{ position: "relative", width: "100%", height: "100%", display: "grid", placeItems: "center" }}>
      {/* Disque central */}
      <Box sx={{
        position: "relative", width: { xs: 200, sm: 240, md: 280 }, height: { xs: 200, sm: 240, md: 280 },
        borderRadius: "50%", background: GRADIENTS.brand, display: "grid", placeItems: "center",
        boxShadow: `0 40px 80px -30px ${BRAND.green}aa`, animation: `${floatSlow} 7s ease-in-out infinite`,
      }}>
        <Box sx={{ position: "absolute", inset: 14, borderRadius: "50%", border: "2px dashed rgba(255,255,255,0.35)",
          animation: `${spinSlow} 24s linear infinite` }} />
        <SavingsRoundedIcon sx={{ fontSize: { xs: 84, md: 110 }, color: "#fff" }} />
      </Box>

      {/* Pièces décoratives */}
      <Box sx={{ position: "absolute", top: "14%", right: "16%", width: 46, height: 46, borderRadius: "50%",
        background: GRADIENTS.amber, boxShadow: `0 12px 24px -8px ${BRAND.amber}`, animation: `${float} 4.2s ease-in-out 0.3s infinite` }} />
      <Box sx={{ position: "absolute", bottom: "16%", left: "12%", width: 32, height: 32, borderRadius: "50%",
        background: GRADIENTS.amber, opacity: 0.85, animation: `${float} 4.8s ease-in-out 0.6s infinite` }} />

      {/* Badges flottants */}
      <FloatingCard sx={{ top: "8%", left: "2%" }} delay={0.2}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Box sx={{ width: 30, height: 30, borderRadius: "50%", bgcolor: BRAND.green, color: "#fff",
            display: "grid", placeItems: "center", fontWeight: 800, fontSize: "0.8rem" }}>K</Box>
          <Box>
            <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, lineHeight: 1.1 }}>Profil vérifié</Typography>
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <VerifiedRoundedIcon sx={{ fontSize: 12, color: BRAND.greenLight }} />
              <Typography sx={{ fontSize: "0.62rem", color: "text.secondary" }}>Carte étudiante</Typography>
            </Stack>
          </Box>
        </Stack>
      </FloatingCard>

      <FloatingCard sx={{ top: "26%", right: "0%" }} delay={0.5}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Box sx={{ width: 30, height: 30, borderRadius: 1.5, bgcolor: BRAND.greenSoft, color: BRAND.green,
            display: "grid", placeItems: "center" }}>
            <TrendingUpRoundedIcon sx={{ fontSize: 18 }} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: "0.78rem", fontWeight: 800, lineHeight: 1.1, color: BRAND.green }}>45 000 FCFA</Typography>
            <Typography sx={{ fontSize: "0.62rem", color: "text.secondary" }}>Revenus ce mois</Typography>
          </Box>
        </Stack>
      </FloatingCard>

      <FloatingCard sx={{ bottom: "10%", right: "12%" }} delay={0.8}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Box sx={{ width: 30, height: 30, borderRadius: 1.5, bgcolor: BRAND.amberSoft, color: BRAND.amberDark,
            display: "grid", placeItems: "center" }}>
            <BoltRoundedIcon sx={{ fontSize: 18 }} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: "0.74rem", fontWeight: 700, lineHeight: 1.1 }}>Nouvelle mission</Typography>
            <Typography sx={{ fontSize: "0.62rem", color: "text.secondary" }}>Cotonou · 20 000 F</Typography>
          </Box>
        </Stack>
      </FloatingCard>
    </Box>
  )
}

const HeroScene = dynamic(
  () => import("./hero-scene").then((m) => ({ default: m.HeroScene })),
  { ssr: false, loading: () => <HeroFallback /> }
)

class SceneBoundary extends Component {
  constructor(props) { super(props); this.state = { failed: false } }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}

function hasWebGL() {
  try {
    const canvas = document.createElement("canvas")
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
    )
  } catch {
    return false
  }
}

/**
 * Affiche la scène 3D si WebGL est disponible, sinon un visuel statique élégant.
 * Évite l'erreur "Error creating WebGL context" qui casserait l'hydratation de la page.
 */
export function HeroVisual() {
  const [mode, setMode] = useState("fallback")

  useEffect(() => {
    if (hasWebGL()) setMode("webgl")
  }, [])

  if (mode !== "webgl") return <HeroFallback />

  return (
    <SceneBoundary fallback={<HeroFallback />}>
      <HeroScene />
    </SceneBoundary>
  )
}
