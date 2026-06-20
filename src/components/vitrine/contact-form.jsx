"use client"

import { useState } from "react"
import Box from "@mui/material/Box"
import { Stack } from "./stack"
import Typography from "@mui/material/Typography"
import TextField from "@mui/material/TextField"
import MenuItem from "@mui/material/MenuItem"
import Button from "@mui/material/Button"
import Alert from "@mui/material/Alert"
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded"
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded"
import { BRAND } from "./theme"

const SUBJECTS = [
  "Question sur mon compte",
  "Problème avec une mission",
  "Paiement / Remboursement",
  "Signaler un utilisateur",
  "Partenariat / Presse",
  "Autre",
]

export function ContactForm() {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [status, setStatus] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const valid = name.trim() && email.trim() && message.trim()

  async function handleSubmit(e) {
    e.preventDefault()
    if (!valid) return
    setIsSubmitting(true)
    await new Promise((r) => setTimeout(r, 1200))
    setStatus("success")
    setIsSubmitting(false)
  }

  if (status === "success") {
    return (
      <Stack alignItems="center" spacing={2} sx={{ justifyContent: "center", py: 6, textAlign: "center" }}>
        <Box sx={{ width: 64, height: 64, borderRadius: "50%", bgcolor: BRAND.greenSoft, display: "grid", placeItems: "center" }}>
          <CheckCircleRoundedIcon sx={{ fontSize: 36, color: BRAND.green }} />
        </Box>
        <Typography variant="h6">Message envoyé !</Typography>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          Nous vous répondrons dans les 24h ouvrées à <b>{email}</b>.
        </Typography>
        <Button onClick={() => { setStatus(null); setName(""); setEmail(""); setSubject(""); setMessage("") }}>
          Envoyer un autre message
        </Button>
      </Stack>
    )
  }

  return (
    <Box component="form" onSubmit={handleSubmit} noValidate sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <TextField label="Nom" required fullWidth value={name} onChange={(e) => setName(e.target.value)} placeholder="Votre nom" />
        <TextField label="Email" type="email" required fullWidth value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@exemple.com" />
      </Stack>

      <TextField select label="Sujet" fullWidth value={subject} onChange={(e) => setSubject(e.target.value)}>
        <MenuItem value=""><em>Sélectionner un sujet</em></MenuItem>
        {SUBJECTS.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
      </TextField>

      <TextField
        label="Message"
        required
        fullWidth
        multiline
        minRows={5}
        value={message}
        onChange={(e) => setMessage(e.target.value.slice(0, 1000))}
        placeholder="Décrivez votre demande en détail..."
        helperText={`${message.length}/1000`}
      />

      {status === "error" && <Alert severity="error">Une erreur est survenue. Réessayez ou contactez-nous par email.</Alert>}

      <Button type="submit" variant="contained" color="primary" size="large" fullWidth
        disabled={!valid || isSubmitting} endIcon={!isSubmitting && <ArrowForwardRoundedIcon />}>
        {isSubmitting ? "Envoi…" : "Envoyer le message"}
      </Button>
    </Box>
  )
}
