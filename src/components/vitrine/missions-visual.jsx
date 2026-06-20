"use client"

import { Component, useEffect, useState } from "react"
import dynamic from "next/dynamic"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import { Stack } from "./stack"
import { keyframes } from "@mui/system"
import WorkRoundedIcon from "@mui/icons-material/WorkRounded"
import BoltRoundedIcon from "@mui/icons-material/BoltRounded"
import { BRAND, GRADIENTS } from "./theme"

const float = keyframes`
  0%, 100% { transform: translateY(0) }
  50% { transform: translateY(-12px) }
`
const floatSlow = keyframes`
  0%, 100% { transform: translateY(0) rotate(0deg) }
  50% { transform: translateY(-9px) rotate(5deg) }
`
const spinSlow = keyframes`
  from { transform: rotate(0deg) } to { transform: rotate(360deg) }
`

/** Visuel statique compact — affiché si WebGL indisponible ou pendant le chargement de la 3D. */
function MissionsFallback() {
  return (
    <Box sx={{ position: "relative", width: "100%", height: "100%", display: "grid", placeItems: "center" }}>
      <Box sx={{
        position: "relative", width: { md: 170, lg: 200 }, height: { md: 170, lg: 200 },
        borderRadius: "50%", background: GRADIENTS.brand, display: "grid", placeItems: "center",
        boxShadow: `0 36px 70px -28px ${BRAND.green}aa`, animation: `${floatSlow} 7s ease-in-out infinite`,
      }}>
        <Box sx={{ position: "absolute", inset: 12, borderRadius: "50%", border: "2px dashed rgba(255,255,255,0.35)",
          animation: `${spinSlow} 22s linear infinite` }} />
        <WorkRoundedIcon sx={{ fontSize: { md: 68, lg: 84 }, color: "#fff" }} />
      </Box>

      <Box sx={{ position: "absolute", top: "16%", right: "20%", width: 40, height: 40, borderRadius: "50%",
        background: GRADIENTS.amber, boxShadow: `0 12px 24px -8px ${BRAND.amber}`, animation: `${float} 4.2s ease-in-out 0.3s infinite` }} />
      <Box sx={{ position: "absolute", bottom: "20%", left: "16%", width: 28, height: 28, borderRadius: "50%",
        background: GRADIENTS.amber, opacity: 0.85, animation: `${float} 4.8s ease-in-out 0.6s infinite` }} />

      <Box sx={{
        position: "absolute", bottom: "12%", right: "8%", zIndex: 2, bgcolor: "rgba(255,255,255,0.88)",
        backdropFilter: "blur(8px)", borderRadius: 3, px: 1.6, py: 1, border: "1px solid rgba(255,255,255,0.6)",
        boxShadow: "0 18px 40px -18px rgba(15,23,42,0.4)", animation: `${float} 5s ease-in-out 0.8s infinite`,
      }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Box sx={{ width: 28, height: 28, borderRadius: 1.5, bgcolor: BRAND.amberSoft, color: BRAND.amberDark,
            display: "grid", placeItems: "center" }}>
            <BoltRoundedIcon sx={{ fontSize: 16 }} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, lineHeight: 1.1 }}>Nouvelle mission</Typography>
            <Typography sx={{ fontSize: "0.6rem", color: "text.secondary" }}>Cotonou · 20 000 F</Typography>
          </Box>
        </Stack>
      </Box>
    </Box>
  )
}

const HeroScene = dynamic(
  () => import("./hero-scene").then((m) => ({ default: m.HeroScene })),
  { ssr: false, loading: () => <MissionsFallback /> }
)

class SceneBoundary extends Component {
  constructor(props) { super(props); this.state = { failed: false } }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}

function hasWebGL() {
  try {
    const canvas = document.createElement("canvas")
    return !!(window.WebGLRenderingContext && (canvas.getContext("webgl") || canvas.getContext("experimental-webgl")))
  } catch {
    return false
  }
}

/** Scène 3D (pièces + blob) pour la bannière missions, avec fallback statique si WebGL absent. */
export function MissionsVisual() {
  const [mode, setMode] = useState("fallback")
  useEffect(() => { if (hasWebGL()) setMode("webgl") }, [])
  if (mode !== "webgl") return <MissionsFallback />
  return (
    <SceneBoundary fallback={<MissionsFallback />}>
      <HeroScene />
    </SceneBoundary>
  )
}
