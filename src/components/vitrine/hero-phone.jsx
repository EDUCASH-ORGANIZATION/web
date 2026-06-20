"use client"

import { Component, useEffect, useState } from "react"
import dynamic from "next/dynamic"
import Box from "@mui/material/Box"
import { Stack } from "./stack"
import Typography from "@mui/material/Typography"
import Avatar from "@mui/material/Avatar"
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded"
import SchoolRoundedIcon from "@mui/icons-material/SchoolRounded"
import QueryStatsRoundedIcon from "@mui/icons-material/QueryStatsRounded"
import { keyframes } from "@mui/system"
import { BRAND, GRADIENTS } from "./theme"

const float = keyframes`
  0%, 100% { transform: translateY(0) rotate(0deg) }
  50% { transform: translateY(-16px) rotate(2deg) }
`

const floatSlow = keyframes`
  0%, 100% { transform: translateY(0) }
  50% { transform: translateY(-10px) }
`

function PhoneScreen() {
  return (
    <Box sx={{ width: 1, height: 1, borderRadius: "26px", overflow: "hidden", position: "relative",
      background: "linear-gradient(180deg, #F8FAFB 0%, #FFFFFF 100%)", display: "flex", flexDirection: "column",
      boxShadow: "inset 0 0 0 1px rgba(15,23,42,0.06)" }}>
      {/* Notch / Dynamic Island */}
      <Box sx={{ position: "absolute", top: { xs: 8, md: 10 }, left: "50%", transform: "translateX(-50%)", width: { xs: 60, md: 70 }, height: { xs: 18, md: 22 },
        borderRadius: 10, bgcolor: "#0E1426", zIndex: 10 }} />

      {/* Header */}
      <Box sx={{ pt: { xs: 4, md: 5 }, px: { xs: 2, md: 2.5 }, pb: { xs: 1, md: 1.5 } }}>
        <Typography sx={{ fontSize: { xs: "0.6rem", md: "0.65rem" }, color: "text.secondary", mb: 0.3 }}>Bonjour 👋</Typography>
        <Typography sx={{ fontWeight: 800, fontSize: { xs: "0.85rem", md: "0.95rem" }, color: "text.primary" }}>Kokou Mensah</Typography>
        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mt: 0.5 }}>
          <CheckCircleRoundedIcon sx={{ fontSize: { xs: 10, md: 11 }, color: BRAND.green }} />
          <Typography sx={{ fontSize: { xs: "0.55rem", md: "0.6rem" }, color: BRAND.green, fontWeight: 700 }}>Profil vérifié</Typography>
        </Stack>
      </Box>

      {/* Stats grid */}
      <Box sx={{ px: { xs: 1.5, md: 2 }, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, mb: { xs: 1, md: 1.5 } }}>
        <Box sx={{ bgcolor: BRAND.green, borderRadius: 1.5, p: { xs: 1.2, md: 1.5 }, color: "#fff", display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: { xs: 80, md: 90 } }}>
          <Typography sx={{ fontSize: { xs: "0.55rem", md: "0.6rem" }, opacity: 0.85, fontWeight: 500 }}>Revenus ce mois</Typography>
          <Box>
            <Typography sx={{ fontWeight: 800, fontSize: { xs: "1.05rem", md: "1.15rem" }, lineHeight: 1 }}>45 000</Typography>
            <Typography sx={{ fontSize: { xs: "0.55rem", md: "0.6rem" }, opacity: 0.9 }}>FCFA</Typography>
          </Box>
        </Box>
        <Box sx={{ bgcolor: "#fff", borderRadius: 1.5, p: { xs: 1.2, md: 1.5 }, border: "1px solid rgba(15,23,42,0.06)", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", minHeight: { xs: 80, md: 90 } }}>
          <Typography sx={{ fontSize: { xs: "0.55rem", md: "0.6rem" }, color: "text.secondary", fontWeight: 500 }}>Missions</Typography>
          <Typography sx={{ fontWeight: 800, fontSize: { xs: "1.4rem", md: "1.55rem" }, color: "text.primary", lineHeight: 1.1 }}>3</Typography>
          <Typography sx={{ fontSize: { xs: "0.55rem", md: "0.6rem" }, color: BRAND.green, fontWeight: 700 }}>actives</Typography>
        </Box>
      </Box>

      {/* Missions list */}
      <Box sx={{ flex: 1, px: { xs: 1.5, md: 2 }, overflow: "hidden" }}>
        <Typography sx={{ fontSize: { xs: "0.5rem", md: "0.55rem" }, fontWeight: 700, letterSpacing: "0.08em", color: "text.secondary", textTransform: "uppercase", mb: 1 }}>
          Missions disponibles
        </Typography>
        <Stack spacing={{ xs: 0.75, md: 1 }}>
          {[
            { icon: "🎓", title: "Cours particuliers", loc: "Cotonou", price: "15 000 F", color: "#EDE9FE" },
            { icon: "📊", title: "Saisie de données", loc: "Calavi", price: "8 000 F", color: "#DBEAFE" },
            { icon: "📱", title: "Community Mgmt", loc: "Porto-Novo", price: "20 000 F", color: "#FEF3C7" },
          ].map((m, i) => (
            <Box key={i} sx={{ bgcolor: "#fff", borderRadius: 2, p: { xs: 1, md: 1.2 }, display: "flex", alignItems: "center", gap: { xs: 0.75, md: 1 },
              border: "1px solid rgba(15,23,42,0.05)" }}>
              <Avatar sx={{ width: { xs: 22, md: 26 }, height: { xs: 22, md: 26 }, fontSize: { xs: "0.7rem", md: "0.8rem" }, bgcolor: m.color, borderRadius: 1.5 }}>{m.icon}</Avatar>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: { xs: "0.6rem", md: "0.65rem" }, fontWeight: 700, color: "text.primary" }}>{m.title}</Typography>
                <Typography sx={{ fontSize: { xs: "0.5rem", md: "0.55rem" }, color: "text.secondary" }}>{m.loc}</Typography>
              </Box>
              <Typography sx={{ fontSize: { xs: "0.6rem", md: "0.65rem" }, fontWeight: 800, color: BRAND.green }}>{m.price}</Typography>
            </Box>
          ))}
        </Stack>
      </Box>

      {/* Bottom nav */}
      <Box sx={{ px: 2, py: { xs: 0.8, md: 1.2 }, display: "flex", justifyContent: "space-around", borderTop: "1px solid rgba(15,23,42,0.05)" }}>
        <Box sx={{ width: { xs: 26, md: 30 }, height: { xs: 26, md: 30 }, borderRadius: 1.5, bgcolor: BRAND.greenSoft, color: BRAND.green, display: "grid", placeItems: "center" }}>
          <SchoolRoundedIcon sx={{ fontSize: { xs: 14, md: 16 } }} />
        </Box>
        <Box sx={{ width: { xs: 26, md: 30 }, height: { xs: 26, md: 30 }, borderRadius: 1.5, color: "text.disabled", display: "grid", placeItems: "center" }}>
          <QueryStatsRoundedIcon sx={{ fontSize: { xs: 14, md: 16 } }} />
        </Box>
      </Box>
    </Box>
  )
}

/** Fallback statique : téléphone CSS stylisé iPhone 17 */
export function HeroPhoneFallback() {
  return (
    <Box sx={{ position: "relative", width: "100%", height: "100%", display: "grid", placeItems: "center" }}>
      <Box sx={{ animation: `${float} 7s ease-in-out infinite`, position: "relative", zIndex: 2 }}>
        {/* Phone frame */}
        <Box sx={{
          width: { xs: 260, sm: 290, md: 320 },
          height: { xs: 540, sm: 600, md: 660 },
          borderRadius: "32px",
          bgcolor: "#0E1426",
          p: "10px",
          boxShadow: "0 40px 80px -20px rgba(14,20,38,0.5), 0 60px 120px -30px rgba(26,107,74,0.25), inset 0 0 0 1px rgba(255,255,255,0.12)",
          position: "relative",
          border: "1px solid rgba(255,255,255,0.15)",
          background: "linear-gradient(145deg, #1A1A2E 0%, #0E1426 50%, #1A1A2E 100%)",
        }}>
          <Box sx={{ width: "100%", height: "100%", borderRadius: "26px", overflow: "hidden", position: "relative",
            bgcolor: "#0E1426" }}>
            <PhoneScreen />
          </Box>
          {/* Side buttons */}
          <Box sx={{ position: "absolute", right: -3, top: "18%", width: 3, height: 52, bgcolor: "#1A1A2E", borderRadius: "2px" }} />
          <Box sx={{ position: "absolute", left: -3, top: "16%", width: 3, height: 36, bgcolor: "#1A1A2E", borderRadius: "2px" }} />
          <Box sx={{ position: "absolute", left: -3, top: "26%", width: 3, height: 36, bgcolor: "#1A1A2E", borderRadius: "2px" }} />
        </Box>
      </Box>

      {/* Floating accents */}
      <Box sx={{ position: "absolute", top: "18%", right: "10%", width: 56, height: 56, borderRadius: 2.5, bgcolor: "#fff",
        boxShadow: "0 16px 40px -14px rgba(15,23,42,0.3)", display: "grid", placeItems: "center", animation: `${floatSlow} 5s ease-in-out 0.3s infinite`, zIndex: 3 }}>
        <Box sx={{ fontSize: "1.5rem" }}>💰</Box>
      </Box>
      <Box sx={{ position: "absolute", bottom: "22%", left: "8%", width: 52, height: 52, borderRadius: "50%", bgcolor: BRAND.green,
        boxShadow: `0 16px 40px -14px ${BRAND.green}88`, display: "grid", placeItems: "center", animation: `${floatSlow} 6s ease-in-out 0.6s infinite`, zIndex: 3 }}>
        <CheckCircleRoundedIcon sx={{ color: "#fff", fontSize: 26 }} />
      </Box>
      <Box sx={{ position: "absolute", top: "10%", left: "14%", width: 16, height: 16, borderRadius: "50%", bgcolor: BRAND.amber, opacity: 0.8, animation: `${floatSlow} 4.5s ease-in-out 0.2s infinite` }} />
      <Box sx={{ position: "absolute", bottom: "12%", right: "18%", width: 12, height: 12, borderRadius: "50%", bgcolor: BRAND.greenLight, opacity: 0.8, animation: `${floatSlow} 5.5s ease-in-out 0.9s infinite` }} />
    </Box>
  )
}

class SceneBoundary extends Component {
  constructor(props) { super(props); this.state = { failed: false } }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}

const HeroPhoneScene = dynamic(
  () => import("./hero-phone-scene").then((m) => ({ default: m.HeroPhoneScene })),
  { ssr: false, loading: () => <HeroPhoneFallback /> }
)

function hasWebGL() {
  try {
    const canvas = document.createElement("canvas")
    return !!(window.WebGLRenderingContext && (canvas.getContext("webgl") || canvas.getContext("experimental-webgl")))
  } catch { return false }
}

export function HeroPhone() {
  const [mode, setMode] = useState("fallback")
  useEffect(() => { if (hasWebGL()) setMode("webgl") }, [])

  if (mode !== "webgl") return <HeroPhoneFallback />

  return (
    <SceneBoundary fallback={<HeroPhoneFallback />}>
      <HeroPhoneScene />
    </SceneBoundary>
  )
}
