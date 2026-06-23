import { notFound } from "next/navigation"
import Link from "next/link"
import Box from "@mui/material/Box"
import Container from "@mui/material/Container"
import Typography from "@mui/material/Typography"
import Card from "@mui/material/Card"
import Chip from "@mui/material/Chip"
import Divider from "@mui/material/Divider"
import Avatar from "@mui/material/Avatar"
import Breadcrumbs from "@mui/material/Breadcrumbs"
import MuiLink from "@mui/material/Link"
import PlaceRoundedIcon from "@mui/icons-material/PlaceRounded"
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded"
import AccessTimeRoundedIcon from "@mui/icons-material/AccessTimeRounded"
import StarRoundedIcon from "@mui/icons-material/StarRounded"
import VerifiedRoundedIcon from "@mui/icons-material/VerifiedRounded"
import NavigateNextRoundedIcon from "@mui/icons-material/NavigateNextRounded"
import { createClient } from "@/lib/supabase/server"
import { VitrineProvider } from "@/components/vitrine/vitrine-provider"
import { VitrineNavbar } from "@/components/vitrine/vitrine-navbar"
import { VitrineFooter } from "@/components/vitrine/vitrine-footer"
import { Stack } from "@/components/vitrine/stack"
import { ApplySidebar } from "@/components/vitrine/apply-sidebar"
import { ApplyStickyButton } from "@/components/vitrine/apply-sticky-button"
import { BRAND } from "@/components/vitrine/theme"

// ─── Helpers ──────────────────────────────────────────────────────────────────

const URGENCY_LABELS = { high: "Urgent", medium: "Cette semaine", low: "Normal" }
const URGENCY_BADGE = {
  high:   { bg: "#FEE2E2", color: "#B91C1C" },
  medium: { bg: "#FFEDD5", color: "#C2410C" },
  low:    { bg: "#F1F5F9", color: "#475569" },
}

const TYPE_COLORS = {
  "Babysitting":          { bg: "#FCE7F3", color: "#BE185D" },
  "Livraison":            { bg: "#DBEAFE", color: "#1D4ED8" },
  "Saisie":               { bg: "#E0E7FF", color: "#4338CA" },
  "Community Management": { bg: "#EDE9FE", color: "#6D28D9" },
  "Traduction":           { bg: "#CFFAFE", color: "#0E7490" },
  "Cours particuliers":   { bg: BRAND.greenSoft, color: BRAND.greenDark },
  "Autre":                { bg: "#F1F5F9", color: "#475569" },
}

function formatBudget(n) {
  return new Intl.NumberFormat("fr-FR").format(n)
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

function truncate(str, max) {
  return str?.length > max ? str.slice(0, max) + "…" : str
}

// ─── Métadonnées SEO ─────────────────────────────────────────────────────────

export async function generateMetadata({ params }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: mission } = await supabase
    .from("missions")
    .select("title, description")
    .eq("id", id)
    .single()

  if (!mission) return { title: "Mission introuvable — EduCash" }

  return {
    title: `${mission.title} — EduCash`,
    description: mission.description?.substring(0, 160) ?? "",
  }
}

// ─── Mini card mission similaire ─────────────────────────────────────────────

function SimilarMissionCard({ mission }) {
  const c = TYPE_COLORS[mission.type] ?? TYPE_COLORS["Autre"]
  return (
    <Link href={`/missions/${mission.id}`} style={{ textDecoration: "none" }}>
      <Card sx={{ p: 2, height: "100%", transition: "box-shadow .2s ease, transform .2s ease",
        "&:hover": { boxShadow: "0 16px 32px -20px rgba(15,23,42,0.3)", transform: "translateY(-2px)" } }}>
        <Stack spacing={1.5}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
            <Chip label={mission.type} size="small"
              sx={{ bgcolor: c.bg, color: c.color, fontWeight: 700, fontSize: "0.65rem", height: 22 }} />
            <Typography sx={{ fontWeight: 800, color: BRAND.amberDark, fontSize: "0.8rem", whiteSpace: "nowrap" }}>
              {formatBudget(mission.budget)} FCFA
            </Typography>
          </Stack>
          <Typography sx={{ fontWeight: 600, fontSize: "0.9rem", lineHeight: 1.35, color: "text.primary",
            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {mission.title}
          </Typography>
          {mission.city && (
            <Stack direction="row" alignItems="center" spacing={0.5} sx={{ color: "text.disabled" }}>
              <PlaceRoundedIcon sx={{ fontSize: 13 }} />
              <Typography variant="caption" sx={{ color: "text.secondary" }}>{mission.city}</Typography>
            </Stack>
          )}
        </Stack>
      </Card>
    </Link>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function MissionDetailPage({ params }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: mission } = await supabase
    .from("missions")
    .select("*")
    .eq("id", id)
    .single()

  if (!mission) notFound()

  const [{ data: clientProfile }, { data: similarMissions }] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, city, avatar_url, rating, missions_done, is_verified")
      .eq("user_id", mission.client_id)
      .single(),
    supabase
      .from("missions")
      .select("id, title, type, city, budget")
      .eq("type", mission.type)
      .eq("status", "open")
      .neq("id", mission.id)
      .limit(4),
  ])

  const clientName = clientProfile?.full_name ?? "Client EduCash"
  const clientInitial = clientName.charAt(0).toUpperCase()
  const rating = clientProfile?.rating ?? 0
  const missionsDone = clientProfile?.missions_done ?? 0
  const urgencyC = URGENCY_BADGE[mission.urgency] ?? URGENCY_BADGE.low
  const typeC = TYPE_COLORS[mission.type] ?? TYPE_COLORS["Autre"]

  return (
    <VitrineProvider>
      <VitrineNavbar />

      <Box sx={{ bgcolor: "#F8FAFB", pb: { xs: 14, lg: 8 } }}>
        <Container sx={{ py: { xs: 4, md: 6 } }}>

          {/* Breadcrumb */}
          <Breadcrumbs separator={<NavigateNextRoundedIcon sx={{ fontSize: 16 }} />} sx={{ mb: 4 }}>
            <MuiLink href="/missions" underline="hover"
              sx={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", fontSize: "0.72rem", color: "text.secondary" }}>
              Missions
            </MuiLink>
            <Typography sx={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", fontSize: "0.72rem", color: "text.disabled" }}>
              {mission.type}
            </Typography>
            <Typography sx={{ fontSize: "0.8rem", color: "text.primary", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {truncate(mission.title, 35)}
            </Typography>
          </Breadcrumbs>

          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "2fr 1fr" }, gap: 4, alignItems: "start" }}>

            {/* Colonne gauche */}
            <Stack spacing={3}>

              {/* Carte principale */}
              <Card sx={{ p: { xs: 3, md: 4 } }}>
                <Stack spacing={2.5}>
                  <Stack direction="row" useFlexGap spacing={1} sx={{ flexWrap: "wrap" }}>
                    <Chip label={mission.type} sx={{ bgcolor: typeC.bg, color: typeC.color, fontWeight: 700 }} />
                    <Chip label={URGENCY_LABELS[mission.urgency] ?? "Normal"} sx={{ bgcolor: urgencyC.bg, color: urgencyC.color, fontWeight: 700 }} />
                  </Stack>

                  <Typography variant="h4" sx={{ fontWeight: 800, fontSize: { xs: "1.6rem", md: "2rem" }, lineHeight: 1.25 }}>
                    {mission.title}
                  </Typography>

                  <Stack direction="row" useFlexGap spacing={3} sx={{ flexWrap: "wrap", color: "text.secondary" }}>
                    {mission.city && (
                      <Stack direction="row" alignItems="center" spacing={0.8}>
                        <PlaceRoundedIcon sx={{ fontSize: 17, color: "text.disabled" }} />
                        <Typography variant="body2">{mission.city}</Typography>
                      </Stack>
                    )}
                    <Stack direction="row" alignItems="center" spacing={0.8}>
                      <CalendarMonthRoundedIcon sx={{ fontSize: 17, color: "text.disabled" }} />
                      <Typography variant="body2">Publiée le {formatDate(mission.created_at)}</Typography>
                    </Stack>
                  </Stack>

                  <Divider />

                  <Stack spacing={1.2}>
                    <Typography variant="overline" sx={{ color: "text.disabled", letterSpacing: "0.12em" }}>Description</Typography>
                    <Typography variant="body2" sx={{ color: "text.secondary", lineHeight: 1.7, whiteSpace: "pre-line" }}>
                      {mission.description}
                    </Typography>
                  </Stack>

                  <Divider />

                  <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
                    {mission.deadline && (
                      <Stack spacing={0.5} sx={{ bgcolor: "#F8FAFB", borderRadius: "12px", p: 2 }}>
                        <Stack direction="row" alignItems="center" spacing={0.6}>
                          <AccessTimeRoundedIcon sx={{ fontSize: 13, color: "text.disabled" }} />
                          <Typography variant="caption" sx={{ fontWeight: 800, color: "text.disabled", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                            Date limite
                          </Typography>
                        </Stack>
                        <Typography sx={{ fontWeight: 700, fontSize: "0.9rem" }}>{formatDate(mission.deadline)}</Typography>
                      </Stack>
                    )}
                    <Stack spacing={0.5} sx={{ bgcolor: BRAND.amberSoft, borderRadius: "12px", p: 2 }}>
                      <Typography variant="caption" sx={{ fontWeight: 800, color: BRAND.amberDark, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                        Rémunération
                      </Typography>
                      <Typography sx={{ fontWeight: 900, color: BRAND.amberDark }}>
                        {formatBudget(mission.budget)} <Box component="span" sx={{ fontSize: "0.75rem", fontWeight: 700 }}>FCFA</Box>
                      </Typography>
                    </Stack>
                  </Box>
                </Stack>
              </Card>

              {/* Carte client */}
              <Card sx={{ p: 3 }}>
                <Typography variant="overline" sx={{ color: "text.disabled", letterSpacing: "0.12em", mb: 2, display: "block" }}>
                  À propos du client
                </Typography>
                <Stack direction="row" alignItems="center" spacing={2}>
                  <Avatar src={clientProfile?.avatar_url || undefined} sx={{ width: 56, height: 56, bgcolor: BRAND.green, fontWeight: 800 }}>
                    {clientInitial}
                  </Avatar>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" useFlexGap alignItems="center" spacing={1} sx={{ flexWrap: "wrap" }}>
                      <Typography sx={{ fontWeight: 700 }}>{clientName}</Typography>
                      {clientProfile?.is_verified && (
                        <Chip size="small" icon={<VerifiedRoundedIcon sx={{ fontSize: "14px !important" }} />} label="Vérifié"
                          sx={{ height: 22, bgcolor: BRAND.greenSoft, color: BRAND.greenDark, fontWeight: 700, fontSize: "0.68rem" }} />
                      )}
                    </Stack>
                    {clientProfile?.city && (
                      <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mt: 0.5, color: "text.disabled" }}>
                        <PlaceRoundedIcon sx={{ fontSize: 13 }} />
                        <Typography variant="caption" sx={{ color: "text.secondary" }}>{clientProfile.city}</Typography>
                      </Stack>
                    )}
                    <Stack direction="row" useFlexGap alignItems="center" spacing={2} sx={{ mt: 1, flexWrap: "wrap" }}>
                      {rating > 0 && (
                        <Stack direction="row" alignItems="center" spacing={0.4}>
                          <StarRoundedIcon sx={{ fontSize: 15, color: "#F59E0B" }} />
                          <Typography variant="caption" sx={{ fontWeight: 700, color: BRAND.amberDark }}>{rating.toFixed(1)}</Typography>
                        </Stack>
                      )}
                      {missionsDone > 0 && (
                        <Typography variant="caption" sx={{ color: "text.disabled" }}>
                          {missionsDone} mission{missionsDone > 1 ? "s" : ""} publiée{missionsDone > 1 ? "s" : ""}
                        </Typography>
                      )}
                    </Stack>
                  </Box>
                </Stack>
              </Card>

              {/* Missions similaires */}
              {similarMissions?.length > 0 && (
                <Stack spacing={2}>
                  <Typography variant="overline" sx={{ color: "text.disabled", letterSpacing: "0.12em" }}>
                    Missions similaires
                  </Typography>
                  <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
                    {similarMissions.map((m) => <SimilarMissionCard key={m.id} mission={m} />)}
                  </Box>
                </Stack>
              )}
            </Stack>

            {/* Colonne droite (desktop) */}
            <Box sx={{ display: { xs: "none", lg: "block" } }}>
              <ApplySidebar
                missionId={mission.id}
                missionTitle={mission.title}
                clientName={clientName}
                budget={mission.budget}
                estimatedDuration={mission.estimated_duration ?? null}
              />
            </Box>
          </Box>
        </Container>
      </Box>

      <VitrineFooter />

      {/* Barre sticky mobile */}
      <ApplyStickyButton missionId={mission.id} missionTitle={mission.title} />
    </VitrineProvider>
  )
}
