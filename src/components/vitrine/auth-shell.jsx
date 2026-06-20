import Link from "next/link"
import Box from "@mui/material/Box"
import Card from "@mui/material/Card"
import Typography from "@mui/material/Typography"
import MuiLink from "@mui/material/Link"
import PaymentsRoundedIcon from "@mui/icons-material/PaymentsRounded"
import VerifiedUserRoundedIcon from "@mui/icons-material/VerifiedUserRounded"
import BoltRoundedIcon from "@mui/icons-material/BoltRounded"
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded"
import { Logo } from "@/components/shared/logo"
import { VitrineProvider } from "./vitrine-provider"
import { Stack } from "./stack"
import { BRAND, GRADIENTS } from "./theme"

const VALUE_PROPS = [
  { icon: PaymentsRoundedIcon, title: "Paiement sécurisé", text: "Tes fonds sont protégés jusqu'à la validation de la mission." },
  { icon: VerifiedUserRoundedIcon, title: "Profils vérifiés", text: "Chaque étudiant est authentifié par sa carte étudiante." },
  { icon: BoltRoundedIcon, title: "Missions locales", text: "Des opportunités près de chez toi, partout au Bénin." },
]

function Wordmark({ light = false }) {
  return (
    <Stack direction="row" alignItems="center" spacing={1.2}>
      <Logo size="md" />
      <Typography component="span" sx={{ fontWeight: 900, fontSize: "1.5rem", letterSpacing: "-0.02em" }}>
        <Box component="span" sx={{ color: light ? "#fff" : BRAND.green }}>Edu</Box>
        <Box component="span" sx={{ color: BRAND.amber }}>Cash</Box>
      </Typography>
    </Stack>
  )
}

/**
 * Coquille d'authentification : panneau de marque (desktop) + carte formulaire.
 * @param {{ title: string, subtitle?: string, children: React.ReactNode, maxWidth?: number }} props
 */
export function AuthShell({ title, subtitle, children, maxWidth = 460 }) {
  const year = new Date().getFullYear()

  return (
    <VitrineProvider>
      <Box sx={{ minHeight: "100vh", display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr", lg: "1.1fr 1fr" } }}>

        {/* Panneau de marque (desktop) */}
        <Box sx={{ display: { xs: "none", md: "flex" }, position: "relative", overflow: "hidden",
          background: GRADIENTS.dark, color: "#fff", p: { md: 6, lg: 8 }, flexDirection: "column", justifyContent: "space-between" }}>
          <Box sx={{ position: "absolute", top: -90, right: -70, width: 300, height: 300, borderRadius: "50%",
            background: `radial-gradient(circle, ${BRAND.green}66, transparent 70%)` }} />
          <Box sx={{ position: "absolute", bottom: -110, left: -90, width: 340, height: 340, borderRadius: "50%",
            background: `radial-gradient(circle, ${BRAND.amber}3a, transparent 70%)` }} />

          <Box sx={{ position: "relative", zIndex: 1 }}>
            <Wordmark light />
          </Box>

          <Stack spacing={3.5} sx={{ position: "relative", zIndex: 1, maxWidth: 440 }}>
            <Typography sx={{ fontWeight: 800, fontSize: { md: "1.9rem", lg: "2.3rem" }, lineHeight: 1.2 }}>
              Finance tes études en{" "}
              <Box component="span" sx={{ background: GRADIENTS.amber, WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                travaillant près de chez toi
              </Box>
              .
            </Typography>

            <Stack spacing={2}>
              {VALUE_PROPS.map(({ icon: Icon, title: t, text }) => (
                <Stack key={t} direction="row" spacing={2} alignItems="flex-start">
                  <Box sx={{ width: 44, height: 44, borderRadius: 2.5, flexShrink: 0, display: "grid", placeItems: "center",
                    bgcolor: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)", backdropFilter: "blur(8px)" }}>
                    <Icon sx={{ fontSize: 22, color: BRAND.amberLight }} />
                  </Box>
                  <Box>
                    <Typography sx={{ fontWeight: 700, fontSize: "0.98rem" }}>{t}</Typography>
                    <Typography sx={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.7)", lineHeight: 1.5 }}>{text}</Typography>
                  </Box>
                </Stack>
              ))}
            </Stack>
          </Stack>

          <Typography variant="caption" sx={{ position: "relative", zIndex: 1, color: "rgba(255,255,255,0.55)" }}>
            © {year} EduCash · Bénin
          </Typography>
        </Box>

        {/* Zone formulaire */}
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", p: { xs: 2.5, sm: 4 }, bgcolor: "#F8FAFB" }}>
          <Box sx={{ width: "100%", maxWidth }}>
            <Box sx={{ mb: 2 }}>
              <MuiLink href="/" underline="hover" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5,
                color: "text.secondary", fontSize: "0.85rem", fontWeight: 600 }}>
                <ArrowBackRoundedIcon sx={{ fontSize: 16 }} />
                Retour à l'accueil
              </MuiLink>
            </Box>

            <Card sx={{ p: { xs: 3, sm: 4 } }}>
              {/* Logo (mobile) */}
              <Box sx={{ display: { xs: "flex", md: "none" }, justifyContent: "center", mb: 3 }}>
                <Wordmark />
              </Box>

              {(title || subtitle) && (
                <Stack spacing={0.5} sx={{ mb: 3 }}>
                  {title && <Typography variant="h5" sx={{ fontWeight: 800 }}>{title}</Typography>}
                  {subtitle && <Typography variant="body2" sx={{ color: "text.secondary" }}>{subtitle}</Typography>}
                </Stack>
              )}

              {children}
            </Card>
          </Box>
        </Box>
      </Box>
    </VitrineProvider>
  )
}
