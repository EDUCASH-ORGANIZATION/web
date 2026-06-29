"use client"

import Link from "next/link"
import Box from "@mui/material/Box"
import Container from "@mui/material/Container"
import { Stack } from "./stack"
import Typography from "@mui/material/Typography"
import Chip from "@mui/material/Chip"
import Card from "@mui/material/Card"
import Button from "@mui/material/Button"
import Avatar from "@mui/material/Avatar"
import VerifiedUserRoundedIcon from "@mui/icons-material/VerifiedUserRounded"
import StarRoundedIcon from "@mui/icons-material/StarRounded"
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded"
import BoltRoundedIcon from "@mui/icons-material/BoltRounded"
import ChildCareRoundedIcon from "@mui/icons-material/ChildCareRounded"
import TwoWheelerRoundedIcon from "@mui/icons-material/TwoWheelerRounded"
import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded"
import KeyboardRoundedIcon from "@mui/icons-material/KeyboardRounded"
import CampaignRoundedIcon from "@mui/icons-material/CampaignRounded"
import TranslateRoundedIcon from "@mui/icons-material/TranslateRounded"
import SchoolRoundedIcon from "@mui/icons-material/SchoolRounded"
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded"
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded"
import { MISSION_TYPES } from "@/lib/supabase/database.constants"
import { BRAND, GRADIENTS } from "./theme"

const MISSION_ICONS = {
  "Babysitting": ChildCareRoundedIcon,
  "Livraison": TwoWheelerRoundedIcon,
  "Saisie": KeyboardRoundedIcon,
  "Community Management": CampaignRoundedIcon,
  "Traduction": TranslateRoundedIcon,
  "Cours particuliers": SchoolRoundedIcon,
  "Autre": AutoAwesomeRoundedIcon,
}

const MISSION_DESCRIPTIONS = {
  "Babysitting": "Garde d'enfants à domicile en toute confiance",
  "Livraison": "Coursier & livraison express en ville",
  "Saisie": "Transcription et entrée de données rapide",
  "Community Management": "Animation et croissance sur les réseaux sociaux",
  "Traduction": "Français, Anglais, Fon et langues locales",
  "Cours particuliers": "Soutien scolaire et universitaire personnalisé",
  "Autre": "Toute autre prestation sur mesure",
}

const TRUST_BADGES = [
  { icon: VerifiedUserRoundedIcon, label: "Profils vérifiés", desc: "Carte étudiante requise" },
  { icon: StarRoundedIcon, label: "Noté 4.8/5", desc: "Par nos utilisateurs" },
  { icon: TrendingUpRoundedIcon, label: "+850 missions", desc: "Réalisées avec succès" },
  { icon: BoltRoundedIcon, label: "Réponse rapide", desc: "Sous 24h en moyenne" },
]

const TESTIMONIALS = [
  { initial: "K", color: BRAND.green, name: "Kokou Mensah", role: "Étudiant Licence 2 · UAC Cotonou",
    quote: "En deux semaines, j'ai décroché 3 missions de cours particuliers. EduCash m'a permis de payer ma scolarité sans demander à mes parents." },
  { initial: "A", color: BRAND.amber, name: "Adjoua Koffi", role: "Gérante · Boutique Mode, Cotonou",
    quote: "J'avais besoin d'aide pour gérer mon Instagram. J'ai trouvé un étudiant compétent en moins de 24h. Paiement simple, mission réussie." },
  { initial: "S", color: BRAND.violet, name: "Serge Dossou", role: "Directeur · PME Logistique, Porto-Novo",
    quote: "La qualité des profils est impressionnante. On a confié notre community management à un étudiant — résultats au-delà de nos attentes." },
]

// ─── Bandeau statistiques ─────────────────────────────────────────────────────
export function StatsBand({ students = 0, missions = 0 }) {
  const stats = [
    { value: students > 0 ? `+${students.toLocaleString("fr-FR")}` : "+1 200", label: "Étudiants" },
    { value: missions > 0 ? `+${missions.toLocaleString("fr-FR")}` : "+850", label: "Missions" },
    { value: "3", label: "Villes" },
    { value: "4.8/5", label: "Note moyenne" },
  ]
  return (
    <Box sx={{ background: GRADIENTS.dark, py: { xs: 4, md: 5 } }}>
      <Container>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2,1fr)", sm: "repeat(4,1fr)" }, gap: 3, textAlign: "center" }}>
          {stats.map(({ value, label }) => (
            <Box key={label}>
              <Typography sx={{ fontWeight: 900, fontSize: { xs: "1.6rem", md: "2rem" }, color: "#fff" }}>{value}</Typography>
              <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.55)", textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 600 }}>{label}</Typography>
            </Box>
          ))}
        </Box>
      </Container>
    </Box>
  )
}

// ─── Badges de confiance ──────────────────────────────────────────────────────
export function TrustBadges() {
  return (
    <Box sx={{ py: { xs: 6, md: 8 }, bgcolor: "#F8FAFB", borderBottom: "1px solid", borderColor: "divider" }}>
      <Container>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2,1fr)", md: "repeat(4,1fr)" }, gap: 2 }}>
          {TRUST_BADGES.map(({ icon: Icon, label, desc }) => (
            <Stack key={label} direction="row" spacing={1.8} alignItems="center"
              sx={{ bgcolor: "#fff", borderRadius: 1, px: 2.5, py: 2.2, border: "1px solid", borderColor: "divider" }}>
              <Box sx={{ width: 46, height: 46, borderRadius: 2.5, bgcolor: BRAND.greenSoft, color: BRAND.green,
                display: "grid", placeItems: "center", flexShrink: 0 }}>
                <Icon />
              </Box>
              <Box>
                <Typography sx={{ fontWeight: 700, fontSize: "0.92rem" }}>{label}</Typography>
                <Typography variant="caption" sx={{ color: "text.secondary" }}>{desc}</Typography>
              </Box>
            </Stack>
          ))}
        </Box>
      </Container>
    </Box>
  )
}

// ─── Types de missions ────────────────────────────────────────────────────────
export function MissionTypes() {
  return (
    <Box component="section" id="missions" sx={{ py: { xs: 8, md: 12 }, bgcolor: "#fff" }}>
      <Container>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}
          sx={{ justifyContent: "space-between", alignItems: { sm: "center" }, mb: 5 }}>
          <Box>
            <Chip label="Catalogue" sx={{ bgcolor: BRAND.greenSoft, color: BRAND.greenDark, fontWeight: 700,
              textTransform: "uppercase", letterSpacing: "0.08em", fontSize: "0.7rem", mb: 2 }} />
            <Typography variant="h2" sx={{ fontSize: { xs: "1.9rem", md: "2.4rem" } }}>Explore les opportunités</Typography>
            <Typography sx={{ color: "text.secondary", mt: 1 }}>
              Trouvez la mission qui correspond à votre emploi du temps et vos talents.
            </Typography>
          </Box>
          <Button component={Link} href="/auth/register" variant="outlined" color="primary"
            endIcon={<ArrowForwardRoundedIcon />}
            sx={{ flexShrink: 0, whiteSpace: "nowrap", alignSelf: { xs: "flex-start", sm: "auto" } }}>
            Voir tout le catalogue
          </Button>
        </Stack>

        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2,1fr)", sm: "repeat(3,1fr)", lg: "repeat(4,1fr)" }, gap: 2.5 }}>
          {MISSION_TYPES.map((type) => {
            const Icon = MISSION_ICONS[type] ?? AutoAwesomeRoundedIcon
            return (
              <Card key={type} component={Link} href="/auth/register"
                sx={{ p: 2.8, textDecoration: "none", display: "block", height: "100%",
                  transition: "transform .2s ease, box-shadow .2s ease, border-color .2s ease",
                  "&:hover": { transform: "translateY(-6px)", boxShadow: "0 22px 44px -22px rgba(15,23,42,0.3)",
                    borderColor: "rgba(26,107,74,0.4)", "& .mt-icon": { background: GRADIENTS.brand, color: "#fff" } } }}>
                <Box className="mt-icon" sx={{ width: 48, height: 48, borderRadius: 2.5, bgcolor: BRAND.greenSoft,
                  color: BRAND.green, display: "grid", placeItems: "center", mb: 1.8, transition: "all .2s ease" }}>
                  <Icon />
                </Box>
                <Typography sx={{ fontWeight: 700, fontSize: "0.95rem", color: "text.primary" }}>{type}</Typography>
                <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5, lineHeight: 1.5 }}>
                  {MISSION_DESCRIPTIONS[type]}
                </Typography>
              </Card>
            )
          })}
        </Box>
      </Container>
    </Box>
  )
}

// ─── Témoignages ──────────────────────────────────────────────────────────────
export function Testimonials() {
  return (
    <Box component="section" sx={{ py: { xs: 8, md: 12 }, bgcolor: "#F8FAFB" }}>
      <Container>
        <Stack spacing={2} sx={{ alignItems: "center", textAlign: "center", mb: 6 }}>
          <Chip label="Témoignages" sx={{ bgcolor: BRAND.greenSoft, color: BRAND.greenDark, fontWeight: 700,
            textTransform: "uppercase", letterSpacing: "0.08em", fontSize: "0.7rem" }} />
          <Typography variant="h2" sx={{ fontSize: { xs: "2rem", md: "2.6rem" } }}>Ils font confiance à EduCash</Typography>
        </Stack>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3,1fr)" }, gap: 3 }}>
          {TESTIMONIALS.map(({ initial, color, name, role, quote }) => (
            <Card key={name} sx={{ p: 3.5, display: "flex", flexDirection: "column", gap: 2, height: "100%" }}>
              <Stack direction="row" spacing={0.3}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <StarRoundedIcon key={i} sx={{ fontSize: 20, color: BRAND.amber }} />
                ))}
              </Stack>
              <Typography sx={{ color: "text.secondary", lineHeight: 1.7, flex: 1 }}>&ldquo;{quote}&rdquo;</Typography>
              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ pt: 1.5, borderTop: "1px solid", borderColor: "divider" }}>
                <Avatar sx={{ bgcolor: color, fontWeight: 700 }}>{initial}</Avatar>
                <Box>
                  <Typography sx={{ fontWeight: 700, fontSize: "0.92rem" }}>{name}</Typography>
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>{role}</Typography>
                </Box>
              </Stack>
            </Card>
          ))}
        </Box>
      </Container>
    </Box>
  )
}

// ─── CTA final ────────────────────────────────────────────────────────────────
export function FinalCTA() {
  return (
    <Box component="section" sx={{ position: "relative", overflow: "hidden", background: GRADIENTS.brand,
      py: { xs: 9, md: 12 } }}>
      <Box sx={{ position: "absolute", top: -80, right: -60, width: 320, height: 320, borderRadius: "50%", bgcolor: "rgba(255,255,255,0.08)" }} />
      <Box sx={{ position: "absolute", bottom: -50, left: -40, width: 200, height: 200, borderRadius: "50%", bgcolor: "rgba(255,255,255,0.08)" }} />
      <Container sx={{ position: "relative" }}>
        <Stack spacing={3} sx={{ alignItems: "center", textAlign: "center", maxWidth: 640, mx: "auto" }}>
          <Typography variant="h2" sx={{ color: "#fff", fontSize: { xs: "2.1rem", md: "2.8rem" } }}>
            Prêt à dynamiser ton budget ?
          </Typography>
          <Typography sx={{ color: "rgba(255,255,255,0.85)", maxWidth: 420 }}>
            Rejoins la plus grande communauté d&apos;étudiants actifs au Bénin et commence à gagner de l&apos;argent dès aujourd&apos;hui.
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ width: { xs: "100%", sm: "auto" } }}>
            <Button component={Link} href="/auth/register" size="large" endIcon={<ArrowForwardRoundedIcon />}
              sx={{ bgcolor: "#fff", color: BRAND.green, "&:hover": { bgcolor: "rgba(255,255,255,0.9)" } }}>
              Rejoindre l&apos;aventure
            </Button>
            <Button component={Link} href="/about" size="large" variant="outlined"
              sx={{ color: "#fff", borderColor: "rgba(255,255,255,0.6)", borderWidth: 2,
                "&:hover": { borderColor: "#fff", bgcolor: "rgba(255,255,255,0.12)", borderWidth: 2 } }}>
              En savoir plus
            </Button>
          </Stack>
        </Stack>
      </Container>
    </Box>
  )
}
