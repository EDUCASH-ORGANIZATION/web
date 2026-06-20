"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import Box from "@mui/material/Box"
import TextField from "@mui/material/TextField"
import MenuItem from "@mui/material/MenuItem"
import Button from "@mui/material/Button"
import Alert from "@mui/material/Alert"
import Typography from "@mui/material/Typography"
import CircularProgress from "@mui/material/CircularProgress"
import PersonRoundedIcon from "@mui/icons-material/PersonRounded"
import BusinessRoundedIcon from "@mui/icons-material/BusinessRounded"
import VolunteerActivismRoundedIcon from "@mui/icons-material/VolunteerActivismRounded"
import PhotoCameraRoundedIcon from "@mui/icons-material/PhotoCameraRounded"
import { Stack } from "@/components/vitrine/stack"
import { AuthShell } from "@/components/vitrine/auth-shell"
import { useToast } from "@/components/shared/toaster"
import { useSupabase } from "@/components/shared/supabase-provider"
import { CITIES } from "@/lib/supabase/database.constants"
import { BRAND } from "@/components/vitrine/theme"

const CLIENT_TYPES = [
  { value: "particulier", label: "Particulier", description: "Besoin ponctuel à la maison", icon: PersonRoundedIcon },
  { value: "pme", label: "PME / Entreprise", description: "Missions professionnelles", icon: BusinessRoundedIcon },
  { value: "association", label: "Association", description: "Projets à impact social", icon: VolunteerActivismRoundedIcon },
]

export default function ClientOnboardingPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { supabase } = useSupabase()

  const [clientType, setClientType] = useState(null)
  const [logoFile, setLogoFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [fullName, setFullName] = useState("")
  const [city, setCity] = useState("")
  const [phone, setPhone] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")

  const logoInputRef = useRef(null)

  function handleLogoChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => setPreviewUrl(ev.target.result)
    reader.readAsDataURL(file)
  }

  async function handleSubmit() {
    const name = fullName.trim()

    if (!name) { setError("Le nom complet ou nom d'entreprise est requis."); return }
    if (!city) { setError("Veuillez choisir une ville."); return }
    setError("")
    setIsSubmitting(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Non authentifié.")
      if (user.user_metadata?.role !== "client") throw new Error("Session incorrecte. Reconnecte-toi en tant que client.")

      let avatarUrl = null

      if (logoFile) {
        const ext = logoFile.name.split(".").pop()
        const fileName = `${user.id}/avatar.${ext}`
        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(fileName, logoFile, { upsert: true })
        if (uploadError) throw uploadError
        const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(fileName)
        avatarUrl = urlData.publicUrl
      }

      const { error: profileError } = await supabase.from("profiles").upsert({
        user_id: user.id,
        full_name: name,
        phone: phone.trim() || null,
        city,
        role: "client",
        avatar_url: avatarUrl,
        bio: clientType,
      }, { onConflict: "user_id" })
      if (profileError) throw profileError

      toast({ message: "Bienvenue sur EduCash !", type: "success" })
      router.push("/client/dashboard")
    } catch (err) {
      setError(err.message ?? "Une erreur est survenue.")
      setIsSubmitting(false)
    }
  }

  const initial = fullName.trim()[0]?.toUpperCase()

  return (
    <AuthShell title="Votre profil client" subtitle="Ces informations seront visibles sur vos missions publiées." maxWidth={520}>
      <Stack spacing={2.5}>
        {/* Type de client */}
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>Vous êtes… *</Typography>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr 1fr" }, gap: 1.5 }}>
            {CLIENT_TYPES.map(({ value, label, description, icon: Icon }) => {
              const selected = clientType === value
              return (
                <Box key={value} component="button" type="button" onClick={() => setClientType(value)}
                  sx={{
                    textAlign: "left", cursor: "pointer", borderRadius: 2.5, p: 2,
                    display: "flex", flexDirection: "row", alignItems: "center", gap: 1.5, transition: "all .15s ease",
                    border: "1.5px solid", borderColor: selected ? BRAND.green : "rgba(15,23,42,0.12)",
                    bgcolor: selected ? BRAND.greenSoft : "#fff",
                    boxShadow: selected ? "0 4px 12px -4px rgba(26,107,74,0.2)" : "none",
                    "&:hover": { borderColor: selected ? BRAND.green : BRAND.greenLight, bgcolor: selected ? BRAND.greenSoft : "rgba(26,107,74,0.02)" },
                  }}>
                  <Box sx={{ width: 44, height: 44, borderRadius: 2, flexShrink: 0, display: "grid", placeItems: "center",
                    bgcolor: selected ? BRAND.green : "rgba(15,23,42,0.04)", color: selected ? "#fff" : "text.secondary",
                    transition: "all .15s ease" }}>
                    <Icon sx={{ fontSize: 22 }} />
                  </Box>
                  <Box>
                    <Typography sx={{ fontWeight: 700, fontSize: "0.9rem", color: selected ? BRAND.greenDark : "text.primary", lineHeight: 1.25 }}>{label}</Typography>
                    <Typography sx={{ fontSize: "0.78rem", color: "text.secondary", mt: 0.2, lineHeight: 1.4 }}>{description}</Typography>
                  </Box>
                </Box>
              )
            })}
          </Box>
        </Box>

        {/* Logo */}
        <Stack spacing={1} sx={{ alignItems: "center" }}>
          <Box component="button" type="button" onClick={() => logoInputRef.current?.click()} aria-label="Choisir un logo ou une photo"
            sx={{ width: 96, height: 96, borderRadius: "50%", cursor: "pointer", overflow: "hidden", border: "2px dashed", borderColor: "divider",
              bgcolor: "#F8FAFB", display: "grid", placeItems: "center", transition: "border-color .15s ease", "&:hover": { borderColor: BRAND.green } }}>
            {previewUrl
              ? <Box component="img" src={previewUrl} alt="Aperçu logo" sx={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : initial
                ? <Typography sx={{ fontSize: "2rem", fontWeight: 800, color: BRAND.green }}>{initial}</Typography>
                : <PhotoCameraRoundedIcon sx={{ fontSize: 28, color: "text.disabled" }} />}
          </Box>
          <Typography variant="caption" sx={{ color: "text.secondary" }}>Logo ou photo (optionnel)</Typography>
          <input ref={logoInputRef} type="file" accept="image/*" hidden onChange={handleLogoChange} />
        </Stack>

        <TextField label="Nom complet ou nom d'entreprise" required value={fullName} onChange={(e) => setFullName(e.target.value)}
          placeholder="Ex : Adjoua Koffi ou Koffi & Associés" fullWidth />

        <TextField select label="Ville" required value={city} onChange={(e) => setCity(e.target.value)} fullWidth
          slotProps={{ select: { displayEmpty: true } }}>
          <MenuItem value="">Sélectionner une ville</MenuItem>
          {CITIES.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
        </TextField>

        <TextField label="Téléphone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
          placeholder="+229 XX XX XX XX" fullWidth />

        {error && <Alert severity="error" sx={{ borderRadius: 2.5 }}>{error}</Alert>}

        <Button variant="contained" size="large" fullWidth onClick={handleSubmit} disabled={!clientType || isSubmitting}
          startIcon={isSubmitting ? <CircularProgress size={18} color="inherit" /> : null}>
          Créer mon profil →
        </Button>
      </Stack>
    </AuthShell>
  )
}
