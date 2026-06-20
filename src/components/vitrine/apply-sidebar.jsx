"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Card from "@mui/material/Card"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import Divider from "@mui/material/Divider"
import TextField from "@mui/material/TextField"
import Button from "@mui/material/Button"
import Alert from "@mui/material/Alert"
import CircularProgress from "@mui/material/CircularProgress"
import MuiLink from "@mui/material/Link"
import SendRoundedIcon from "@mui/icons-material/SendRounded"
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded"
import GppMaybeRoundedIcon from "@mui/icons-material/GppMaybeRounded"
import LockRoundedIcon from "@mui/icons-material/LockRounded"
import { Stack } from "./stack"
import { useAuth } from "@/hooks/use-auth"
import { useSupabase } from "@/components/shared/supabase-provider"
import { BRAND } from "./theme"

function formatBudget(n) {
  return new Intl.NumberFormat("fr-FR").format(n)
}

/**
 * Sidebar de candidature (desktop) — version Material UI.
 * @param {{ missionId: string, missionTitle: string, clientName: string,
 *           budget: number, estimatedDuration: string | null }} props
 */
export function ApplySidebar({ missionId, clientName, budget, estimatedDuration }) {
  const { supabase } = useSupabase()
  const { user, role, isLoading } = useAuth()

  const [message, setMessage] = useState("")
  const [isApplied, setIsApplied] = useState(false)
  const [isVerified, setIsVerified] = useState(null)
  const [checking, setChecking] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  const netGain = Math.round(budget * 0.88)

  useEffect(() => {
    if (!user || role !== "student") return
    setChecking(true)
    Promise.all([
      supabase.from("applications").select("id").eq("mission_id", missionId).eq("student_id", user.id).maybeSingle(),
      supabase.from("profiles").select("is_verified").eq("user_id", user.id).single(),
    ]).then(([{ data: app }, { data: profile }]) => {
      setIsApplied(!!app)
      setIsVerified(profile?.is_verified ?? false)
      setChecking(false)
    })
  }, [user, role, missionId, supabase])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!message.trim()) { setError("Le message de candidature est requis."); return }
    setError("")
    setSubmitting(true)
    const { error: insertError } = await supabase.from("applications").insert({
      mission_id: missionId, student_id: user.id, message: message.trim(), status: "pending",
    })
    if (insertError) { setError("Une erreur est survenue. Réessayez."); setSubmitting(false); return }
    setSubmitting(false)
    setSuccess(true)
    setIsApplied(true)
  }

  const disabled = isApplied || success || !user || role !== "student"

  return (
    <Card sx={{ p: 3, position: "sticky", top: 24 }}>
      <Stack spacing={2.5}>
        <Box>
          <Typography variant="overline" sx={{ color: "text.disabled", letterSpacing: "0.1em" }}>
            Postuler à cette mission
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Proposée par <Box component="span" sx={{ fontWeight: 700, color: "text.primary" }}>{clientName}</Box>
          </Typography>
        </Box>

        <Divider />

        <TextField
          label="Ma motivation"
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, 500))}
          multiline
          minRows={5}
          fullWidth
          disabled={disabled}
          placeholder="Présentez-vous, expliquez pourquoi vous êtes le bon profil pour cette mission…"
          helperText={`${message.length}/500`}
          slotProps={{ formHelperText: { sx: { textAlign: "right", mr: 0 } } }}
        />

        <Stack spacing={1} sx={{ bgcolor: "#F8FAFB", borderRadius: 2.5, px: 2, py: 1.5 }}>
          {estimatedDuration && (
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="body2" sx={{ color: "text.secondary" }}>Temps estimé</Typography>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>{estimatedDuration}</Typography>
            </Stack>
          )}
          <Stack direction="row" justifyContent="space-between">
            <Typography variant="body2" sx={{ color: "text.secondary" }}>Engagement</Typography>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>Unique</Typography>
          </Stack>
        </Stack>

        <Stack direction="row" justifyContent="space-between" alignItems="center"
          sx={{ bgcolor: BRAND.greenSoft, borderRadius: 2.5, px: 2, py: 1.5 }}>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>Votre gain net</Typography>
          <Typography sx={{ fontWeight: 900, color: BRAND.green }}>
            {formatBudget(netGain)} <Box component="span" sx={{ fontSize: "0.75rem", fontWeight: 700 }}>FCFA</Box>
          </Typography>
        </Stack>

        {error && <Alert severity="error" sx={{ borderRadius: 2.5 }}>{error}</Alert>}

        {isLoading || checking ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 1 }}><CircularProgress size={22} /></Box>
        ) : !user ? (
          <Button component={Link} href={`/auth/login?next=/missions/${missionId}`} fullWidth size="large"
            variant="contained" startIcon={<LockRoundedIcon />}>
            Se connecter pour postuler
          </Button>
        ) : role !== "student" ? (
          <Button fullWidth size="large" disabled variant="contained">Réservé aux étudiants</Button>
        ) : isApplied || success ? (
          <Button fullWidth size="large" disabled variant="outlined" startIcon={<CheckCircleRoundedIcon />}
            sx={{ color: `${BRAND.green} !important`, borderColor: BRAND.greenSoft }}>
            Candidature envoyée
          </Button>
        ) : isVerified === false ? (
          <Stack spacing={1.5}>
            <Alert severity="warning" icon={<GppMaybeRoundedIcon />} sx={{ borderRadius: 2.5 }}>
              Votre profil doit être vérifié pour postuler.{" "}
              <MuiLink component={Link} href="/profile" sx={{ fontWeight: 700 }}>Compléter mon dossier →</MuiLink>
            </Alert>
            <Button fullWidth size="large" disabled variant="contained" startIcon={<SendRoundedIcon />}>
              Envoyer ma candidature
            </Button>
          </Stack>
        ) : (
          <Button fullWidth size="large" variant="contained" onClick={handleSubmit} disabled={submitting}
            startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : <SendRoundedIcon />}>
            Envoyer ma candidature
          </Button>
        )}

        <Typography variant="caption" sx={{ color: "text.disabled", textAlign: "center", lineHeight: 1.6 }}>
          EduCash prélève une commission de 12 % sur le budget de la mission.
        </Typography>
      </Stack>
    </Card>
  )
}
