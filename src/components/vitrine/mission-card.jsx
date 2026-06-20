"use client"

import Card from "@mui/material/Card"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import Chip from "@mui/material/Chip"
import Button from "@mui/material/Button"
import Divider from "@mui/material/Divider"
import PlaceRoundedIcon from "@mui/icons-material/PlaceRounded"
import AccessTimeRoundedIcon from "@mui/icons-material/AccessTimeRounded"
import { Stack } from "./stack"
import { BRAND } from "./theme"

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  if (days > 0) return `il y a ${days}j`
  if (hours > 0) return `il y a ${hours}h`
  if (minutes > 0) return `il y a ${minutes}min`
  return "à l'instant"
}

const TYPE_COLORS = {
  "Babysitting":          { bg: "#FCE7F3", color: "#BE185D" },
  "Livraison":            { bg: "#DBEAFE", color: "#1D4ED8" },
  "Saisie":               { bg: "#CCFBF1", color: "#0F766E" },
  "Community Management":  { bg: "#E0E7FF", color: "#4338CA" },
  "Traduction":           { bg: "#CFFAFE", color: "#0E7490" },
  "Cours particuliers":   { bg: BRAND.greenSoft, color: BRAND.greenDark },
  "Autre":                { bg: "#F1F5F9", color: "#475569" },
}

const URGENCY_BADGE = {
  high:   { label: "Urgent", bg: "#FEF3C7", color: "#B45309" },
  medium: { label: "Moyen", bg: "#FFEDD5", color: "#C2410C" },
}

/**
 * Carte mission — version Material UI pour le site vitrine.
 * @param {{ mission: any, showApplyButton?: boolean, isApplied?: boolean,
 *           onApply?: (m:any)=>void, onOpen?: ()=>void }} props
 */
export function MissionCard({ mission, showApplyButton = false, isApplied = false, onApply, onOpen }) {
  const budget = new Intl.NumberFormat("fr-FR").format(mission.budget)
  const isUrgent = mission.urgency === "high"
  const badge = isUrgent
    ? URGENCY_BADGE.high
    : { label: mission.type, ...(TYPE_COLORS[mission.type] ?? TYPE_COLORS["Autre"]) }

  return (
    <Card
      onClick={onOpen}
      sx={{
        display: "flex", flexDirection: "column", height: "100%", overflow: "hidden",
        cursor: onOpen ? "pointer" : "default",
        transition: "transform .2s ease, box-shadow .2s ease, border-color .2s ease",
        "&:hover": { transform: "translateY(-4px)", boxShadow: "0 20px 40px -22px rgba(15,23,42,0.3)", borderColor: "rgba(26,107,74,0.35)" },
      }}
    >
      <Box sx={{ p: 2.5, flex: 1, display: "flex", flexDirection: "column", gap: 1.5 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
          <Chip label={badge.label} size="small"
            sx={{ bgcolor: badge.bg, color: badge.color, fontWeight: 700, textTransform: "uppercase",
              fontSize: "0.65rem", letterSpacing: "0.04em", height: 22 }} />
          <Typography sx={{ fontWeight: 800, color: BRAND.green, fontSize: "0.92rem", whiteSpace: "nowrap" }}>
            {budget} FCFA
          </Typography>
        </Stack>

        <Typography sx={{ fontWeight: 700, fontSize: "1.02rem", lineHeight: 1.3, color: "text.primary",
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {mission.title}
        </Typography>

        {mission.description && (
          <Typography variant="body2" sx={{ color: "text.secondary", lineHeight: 1.55, flex: 1,
            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {mission.description}
          </Typography>
        )}

        <Stack direction="row" spacing={2} sx={{ mt: "auto", color: "text.disabled" }}>
          {mission.city && (
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <PlaceRoundedIcon sx={{ fontSize: 14 }} />
              <Typography variant="caption" sx={{ color: "text.secondary" }}>{mission.city}</Typography>
            </Stack>
          )}
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <AccessTimeRoundedIcon sx={{ fontSize: 14 }} />
            <Typography variant="caption" sx={{ color: "text.secondary" }}>{timeAgo(mission.created_at)}</Typography>
          </Stack>
        </Stack>
      </Box>

      {showApplyButton && (
        <>
          <Divider />
          {isApplied ? (
            <Box sx={{ py: 1.5, textAlign: "center", bgcolor: "#F8FAFB", color: "text.disabled",
              fontSize: "0.85rem", fontWeight: 600 }}>
              ✓ Candidature envoyée
            </Box>
          ) : (
            <Button
              fullWidth
              onClick={(e) => { e.stopPropagation(); onApply?.(mission) }}
              sx={{ borderRadius: 0, py: 1.4, color: BRAND.green, fontWeight: 700,
                "&:hover": { bgcolor: BRAND.greenSoft, transform: "none" } }}
            >
              Postuler
            </Button>
          )}
        </>
      )}
    </Card>
  )
}
