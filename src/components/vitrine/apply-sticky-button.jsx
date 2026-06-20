"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Box from "@mui/material/Box"
import Button from "@mui/material/Button"
import Dialog from "@mui/material/Dialog"
import DialogTitle from "@mui/material/DialogTitle"
import DialogContent from "@mui/material/DialogContent"
import DialogActions from "@mui/material/DialogActions"
import TextField from "@mui/material/TextField"
import Typography from "@mui/material/Typography"
import Alert from "@mui/material/Alert"
import CircularProgress from "@mui/material/CircularProgress"
import SendRoundedIcon from "@mui/icons-material/SendRounded"
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded"
import { useAuth } from "@/hooks/use-auth"
import { useSupabase } from "@/components/shared/supabase-provider"

const barSx = {
  position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 30,
  bgcolor: "#fff", borderTop: "1px solid", borderColor: "divider",
  px: 2, py: 2, display: { xs: "block", lg: "none" },
}

function ApplyModal({ open, onClose, missionId, missionTitle, onSuccess }) {
  const { supabase } = useSupabase()
  const { user } = useAuth()
  const [message, setMessage] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(e) {
    e.preventDefault()
    if (!message.trim()) { setError("Le message de candidature est requis."); return }
    setError("")
    setIsSubmitting(true)
    const { error: insertError } = await supabase.from("applications").insert({
      mission_id: missionId, student_id: user.id, message: message.trim(), status: "pending",
    })
    if (insertError) { setError("Une erreur est survenue. Réessayez."); setIsSubmitting(false); return }
    setIsSubmitting(false)
    setMessage("")
    onSuccess()
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm"
      slotProps={{ paper: { sx: { borderRadius: 3 }, component: "form", onSubmit: handleSubmit } }}>
      <DialogTitle sx={{ fontWeight: 800 }}>Postuler à cette mission</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
          Mission : <Box component="span" sx={{ fontWeight: 600, color: "text.primary" }}>{missionTitle}</Box>
        </Typography>
        <TextField
          autoFocus
          label="Votre message de candidature"
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, 600))}
          multiline minRows={5} fullWidth
          placeholder="Présentez-vous, expliquez pourquoi vous êtes le bon profil et votre disponibilité…"
          helperText={`${message.length}/600`}
          slotProps={{ formHelperText: { sx: { textAlign: "right", mr: 0 } } }}
        />
        {error && <Alert severity="error" sx={{ mt: 2, borderRadius: 2.5 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} disabled={isSubmitting} color="inherit">Annuler</Button>
        <Button type="submit" variant="contained" disabled={isSubmitting}
          startIcon={isSubmitting ? <CircularProgress size={16} color="inherit" /> : <SendRoundedIcon />}>
          Envoyer ma candidature
        </Button>
      </DialogActions>
    </Dialog>
  )
}

/**
 * Barre fixe en bas (mobile) — version Material UI.
 * @param {{ missionId: string, missionTitle: string }} props
 */
export function ApplyStickyButton({ missionId, missionTitle }) {
  const { supabase } = useSupabase()
  const { user, role, isLoading } = useAuth()
  const [isApplied, setIsApplied] = useState(false)
  const [checking, setChecking] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => {
    if (!user || role !== "student") return
    setChecking(true)
    supabase.from("applications").select("id").eq("mission_id", missionId).eq("student_id", user.id).maybeSingle()
      .then(({ data }) => { setIsApplied(!!data); setChecking(false) })
  }, [user, role, missionId, supabase])

  if (isLoading || checking) {
    return (
      <Box sx={barSx}>
        <Box sx={{ display: "flex", justifyContent: "center", height: 40, alignItems: "center" }}>
          <CircularProgress size={22} />
        </Box>
      </Box>
    )
  }

  if (!user) {
    return (
      <Box sx={barSx}>
        <Button component={Link} href={`/auth/register?redirect=/missions/${missionId}`} fullWidth variant="contained">
          S&apos;inscrire pour postuler
        </Button>
      </Box>
    )
  }

  if (role !== "student") return null

  if (isApplied) {
    return (
      <Box sx={barSx}>
        <Button fullWidth disabled variant="outlined" startIcon={<CheckCircleRoundedIcon />}>
          Candidature envoyée
        </Button>
      </Box>
    )
  }

  return (
    <>
      <Box sx={barSx}>
        <Button fullWidth variant="contained" onClick={() => setModalOpen(true)} startIcon={<SendRoundedIcon />}>
          Postuler à cette mission
        </Button>
      </Box>
      <ApplyModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        missionId={missionId}
        missionTitle={missionTitle}
        onSuccess={() => setIsApplied(true)}
      />
    </>
  )
}
