"use client"

import Link from "next/link"
import Box from "@mui/material/Box"
import Container from "@mui/material/Container"
import { Stack } from "./stack"
import Typography from "@mui/material/Typography"
import Button from "@mui/material/Button"
import Chip from "@mui/material/Chip"
import Avatar from "@mui/material/Avatar"
import AvatarGroup from "@mui/material/AvatarGroup"
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded"
import { keyframes } from "@mui/system"
import { BRAND, GRADIENTS } from "./theme"
import { HeroPhone } from "./hero-phone"

const pulse = keyframes`
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.45; transform: scale(0.7); }
`

const AVATARS = [
  { l: "K", c: BRAND.green },
  { l: "A", c: BRAND.amber },
  { l: "S", c: BRAND.violet },
  { l: "M", c: BRAND.sky },
]

export function Hero({ students = 0 }) {
  return (
    <Box
      component="section"
      sx={{
        position: "relative",
        overflow: "hidden",
        background: GRADIENTS.hero,
        pt: { xs: 5, md: 8 },
        pb: { xs: 6, md: 10 },
      }}
    >
      {/* Blobs décoratifs */}
      <Box sx={{ position: "absolute", top: -160, right: -120, width: 420, height: 420, borderRadius: "50%",
        background: `radial-gradient(circle, ${BRAND.green}22 0%, transparent 70%)`, filter: "blur(20px)", pointerEvents: "none" }} />
      <Box sx={{ position: "absolute", bottom: -120, left: -100, width: 320, height: 320, borderRadius: "50%",
        background: `radial-gradient(circle, ${BRAND.amber}22 0%, transparent 70%)`, filter: "blur(20px)", pointerEvents: "none" }} />

      <Container sx={{ position: "relative" }}>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1.05fr 0.95fr" }, gap: { xs: 4, md: 6 }, alignItems: "center" }}>
          {/* Colonne texte */}
          <Stack spacing={3} sx={{ py: { xs: 2, md: 4 } }}>
            <Chip
              label="La référence estudiantine au Bénin"
              icon={<Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: BRAND.green, animation: `${pulse} 1.8s ease-in-out infinite`, ml: 1 }} />}
              sx={{ alignSelf: "flex-start", bgcolor: BRAND.greenSoft, color: BRAND.greenDark,
                fontWeight: 700, fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.06em", py: 2 }}
            />

            <Typography variant="h1" sx={{ fontSize: { xs: "2.5rem", sm: "3.25rem", md: "3.6rem" } }}>
              Transforme tes<br />compétences en{" "}
              <Box component="span" sx={{
                background: GRADIENTS.text, WebkitBackgroundClip: "text", backgroundClip: "text",
                WebkitTextFillColor: "transparent", position: "relative",
              }}>
                revenu
              </Box>
            </Typography>

            <Typography sx={{ color: "text.secondary", fontSize: "1.06rem", lineHeight: 1.7, maxWidth: 480 }}>
              Des missions ponctuelles rémunérées pour les étudiants de{" "}
              <Box component="span" sx={{ fontWeight: 700, color: "text.primary" }}>Cotonou, Calavi et Porto-Novo</Box>.
              Alliez études et autonomie financière.
            </Typography>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <Button component={Link} href="/auth/register" variant="contained" color="primary" size="large"
                endIcon={<ArrowForwardRoundedIcon />}>
                Je suis étudiant
              </Button>
              <Button component={Link} href="/auth/register" variant="outlined" color="primary" size="large">
                Je cherche un prestataire
              </Button>
            </Stack>

            <Stack direction="row" alignItems="center" spacing={1.5} sx={{ pt: 1 }}>
              <AvatarGroup sx={{ "& .MuiAvatar-root": { width: 34, height: 34, fontSize: "0.82rem", fontWeight: 700, border: "2px solid #fff" } }}>
                {AVATARS.map(({ l, c }) => (
                  <Avatar key={l} sx={{ bgcolor: c }}>{l}</Avatar>
                ))}
              </AvatarGroup>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                <Box component="span" sx={{ fontWeight: 800, color: "text.primary" }}>
                  {students > 0 ? `+${students.toLocaleString("fr-FR")}` : "+1 200"}
                </Box>{" "}étudiants inscrits
              </Typography>
            </Stack>
          </Stack>

          {/* Colonne 3D */}
          <Box sx={{ position: "relative", height: { xs: 420, sm: 520, md: 600 }, order: { xs: -1, md: 0 } }}>
            <Box sx={{ position: "absolute", inset: "8% 12%", borderRadius: "50%",
              background: `radial-gradient(circle, ${BRAND.green}33 0%, transparent 65%)`, filter: "blur(30px)" }} />
            <HeroPhone />
          </Box>
        </Box>
      </Container>
    </Box>
  )
}
